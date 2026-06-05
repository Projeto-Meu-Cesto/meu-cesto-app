/**
 * productService.ts
 *
 * Substitui o antigo cosmosService.ts.
 * Arquitetura cache-first:
 *   1º verifica Firestore (product_cache/{barcode})
 *   2º se miss → chama Open Food Facts API (gratuita, sem token)
 *   3º salva resultado no Firestore para próximas consultas (TTL 30 dias)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { normalizeText, wait } from './utils';

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Produto por código: BR costuma ter dados locais; world é fallback. */
const OFF_PRODUCT_BR = 'https://br.openfoodfacts.org';
const OFF_PRODUCT_WORLD = 'https://world.openfoodfacts.org';
/** Hosts para busca por nome (OFF oscila 503 — tentamos em ordem). */
const OFF_SEARCH_HOSTS = [
  'https://world.openfoodfacts.org',
  'https://br.openfoodfacts.org',
];

const SEARCH_MEMORY_TTL_MS = 5 * 60 * 1000;
const SEARCH_MAX_ATTEMPTS = 4;

/** Cache em memória da sessão — evita lista vazia quando a OFF falha em sequência. */
const searchMemory = new Map<string, { at: number; products: Product[] }>();

/** User-Agent obrigatório pela Open Food Facts para evitar bloqueio de requisições */
const OFF_HEADERS: HeadersInit = {
  'User-Agent': 'MeuCesto/1.0 (https://meucesto.app; contato@meucesto.app)',
  'Accept': 'application/json',
};

/** TTL do cache no Firestore: 30 dias em ms */
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

/** Placeholder para produtos sem imagem (nunca quebra a UI) */
export const PRODUCT_IMAGE_PLACEHOLDER =
  'https://placehold.co/200x200/e2e8f0/94a3b8?text=Sem+Foto';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Product {
  /** EAN / GTIN do produto (string para compatibilidade) */
  barcode: string;
  /** Nome do produto em pt ou fallback em inglês */
  name: string;
  /** Marca do produto */
  brand: string;
  /** Quantidade / tamanho (ex: "1L", "500g") */
  quantity: string;
  /** URL da imagem frontal */
  image_url: string;
  /** Categoria normalizada para o app */
  category: string;
  /** Preço médio (pode ser nulo se não cadastrado) */
  avg_price?: number;
  /** Fonte do dado: "cache" (Firestore) ou "api" (OFF) */
  source: 'cache' | 'api';
  /** ISO string de quando foi salvo no cache */
  cached_at?: string;
  /** Nome em minúsculas para busca prefixada no Firestore */
  name_lower?: string;

  // Campos de compatibilidade com o formato antigo (CosmosProduct)
  gtin: string;
  description: string;
  thumbnail?: string;
  brand_name?: string;
}

// ─── Ícones de fallback por categoria ────────────────────────────────────────

export const CATEGORY_FALLBACK_ICONS: Record<string, string> = {
  'frutas':     'nutrition-outline',
  'laticínios': 'water-outline',
  'limpeza':    'sparkles-outline',
  'higiene':    'body-outline',
  'bebidas':    'wine-outline',
  'padaria':    'pizza-outline',
  'carnes':     'fast-food-outline',
  'default':    'cart-outline',
};

// ─── Normalização da resposta da Open Food Facts ──────────────────────────────

function normalizeOFFProduct(raw: any, barcode: string): Product {
  const product = raw?.product ?? {};

  // Nome: prioriza pt-BR, depois inglês, depois nome genérico
  const name =
    product.product_name_pt?.trim() ||
    product.product_name?.trim() ||
    product.abbreviated_product_name?.trim() ||
    'Produto sem nome';

  // Marca
  const brand =
    (product.brands?.split(',')[0]?.trim()) ||
    'Marca não informada';

  // Quantidade / tamanho
  const quantity = product.quantity?.trim() || '';

  // Imagem: prioriza frontal em PT, depois genérica
  const image_url =
    product.image_front_url?.trim() ||
    product.image_front_small_url?.trim() ||
    product.image_url?.trim() ||
    PRODUCT_IMAGE_PLACEHOLDER;

  // Categoria: usa taxonomia OFF simplificada
  const offCategory = product.categories_tags?.[0] ?? '';
  const category = mapOFFCategory(offCategory, name);

  const hasRealImage = image_url !== PRODUCT_IMAGE_PLACEHOLDER;

  return {
    barcode,
    name,
    name_lower: name.toLowerCase(),
    brand,
    quantity,
    image_url,
    category,
    source: 'api',
    cached_at: new Date().toISOString(),
    gtin: barcode,
    description: name,
    ...(hasRealImage ? { thumbnail: image_url } : {}),
    ...(brand !== 'Marca não informada' ? { brand_name: brand } : {}),
  };
}

/** Firestore não aceita campos com valor `undefined`. */
function stripUndefinedFields<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

/** URL de imagem para exibição (thumbnail, image_url ou placeholder). */
export function getProductImageUrl(
  product: Pick<Product, 'image_url' | 'thumbnail'>
): string {
  return product.thumbnail || product.image_url || PRODUCT_IMAGE_PLACEHOLDER;
}

export function hasProductImage(product: Pick<Product, 'image_url' | 'thumbnail'>): boolean {
  const url = getProductImageUrl(product);
  return url !== PRODUCT_IMAGE_PLACEHOLDER;
}

async function parseOFFJson<T>(res: Response): Promise<T | null> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Mapeia categorias da taxonomia Open Food Facts para as categorias do app */
function mapOFFCategory(tag: string, name: string): string {
  const t = tag.toLowerCase();
  const n = normalizeText(name);

  if (/fruit|fruta|banana|maca|uva|morango|laranja|abacaxi|mamao|melancia/.test(t + ' ' + n)) return 'Frutas';
  if (/dairy|laticin|leite|queijo|iogurte|manteiga|requeijao/.test(t + ' ' + n)) return 'Laticínios';
  if (/cleaning|limpeza|detergente|sabao|amaciante|desinfetante|cloro/.test(t + ' ' + n)) return 'Limpeza';
  if (/hygiene|higiene|shampoo|sabonete|pasta|desodorante|absorvente/.test(t + ' ' + n)) return 'Higiene';
  if (/beverage|bebida|agua|suco|refrigerante|cerveja|vinho|cafe|energetico/.test(t + ' ' + n)) return 'Bebidas';
  if (/bakery|padaria|pao|bolo|biscoito|bolacha|rosca/.test(t + ' ' + n)) return 'Padaria';
  if (/meat|carne|frango|peixe|linguica|presunto|salame|bife|costela/.test(t + ' ' + n)) return 'Carnes';

  return 'Outros';
}

// ─── Cache Firestore ──────────────────────────────────────────────────────────

async function getFromFirestoreCache(barcode: string): Promise<Product | null> {
  try {
    const ref = doc(db, 'product_cache', barcode);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;

    const data = snap.data() as Product;
    // Verifica TTL
    if (data.cached_at) {
      const age = Date.now() - new Date(data.cached_at).getTime();
      if (age > CACHE_TTL_MS) return null; // expirado
    }

    return { ...data, source: 'cache' };
  } catch {
    return null;
  }
}

async function saveToFirestoreCache(product: Product): Promise<void> {
  if (!product.barcode) return;

  try {
    const ref = doc(db, 'product_cache', product.barcode);
    const payload = stripUndefinedFields({
      ...product,
      source: 'cache' as const,
    });
    await setDoc(ref, payload, { merge: true });
  } catch (error) {
    console.warn('[ProductCache] Não foi possível salvar no cache:', error);
  }
}

// ─── Open Food Facts API ──────────────────────────────────────────────────────

/**
 * Busca produto por código de barras na Open Food Facts.
 * Retorna null se não encontrado ou se a API falhar.
 */
async function fetchFromOFFAtBase(baseUrl: string, barcode: string): Promise<Product | null> {
  const fields =
    'product_name,product_name_pt,brands,quantity,image_front_url,image_front_small_url,image_url,categories_tags';
  const url = `${baseUrl}/api/v2/product/${barcode}.json?fields=${fields}`;
  const res = await fetch(url, { headers: OFF_HEADERS });
  if (!res.ok) return null;

  const data = await parseOFFJson<{ status?: number; product?: unknown }>(res);
  if (!data || data.status !== 1 || !data.product) return null;

  return normalizeOFFProduct(data, barcode);
}

async function fetchFromOFF(barcode: string): Promise<Product | null> {
  try {
    const fromBr = await fetchFromOFFAtBase(OFF_PRODUCT_BR, barcode);
    if (fromBr) return fromBr;
    return await fetchFromOFFAtBase(OFF_PRODUCT_WORLD, barcode);
  } catch (error) {
    console.warn('[OFF] Erro ao buscar por barcode:', error);
    return null;
  }
}

function mapOFFSearchProducts(raw: unknown[]): Product[] {
  return raw
    .filter((p) => (p as Record<string, unknown>).product_name || (p as Record<string, unknown>).product_name_pt)
    .map((p) => normalizeOFFProduct({ product: p }, String((p as Record<string, unknown>).code || '')))
    .filter((p) => p.barcode);
}

async function searchOFFAtHost(
  host: string,
  name: string,
  pageSize: number
): Promise<Product[] | null> {
  const params = new URLSearchParams({
    search_terms: name,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(pageSize),
    lc: 'pt',
    fields:
      'code,product_name,product_name_pt,brands,quantity,image_front_url,image_front_small_url,image_url,categories_tags',
    sort_by: 'popularity_key',
  });

  const res = await fetch(`${host}/cgi/search.pl?${params.toString()}`, {
    headers: OFF_HEADERS,
  });

  if (res.status === 503 || res.status === 429 || res.status >= 500) {
    console.warn(`[OFF] ${host} HTTP ${res.status} — tentando outro servidor`);
    return null;
  }

  if (!res.ok) {
    console.warn(`[OFF] ${host} HTTP ${res.status}`);
    return null;
  }

  const data = await parseOFFJson<{ products?: unknown[] }>(res);
  if (!data?.products) {
    console.warn(`[OFF] ${host} resposta inválida`);
    return null;
  }

  return mapOFFSearchProducts(data.products);
}

/**
 * Busca produtos por nome na Open Food Facts (campo de texto livre).
 * Retenta em hosts alternativos quando a OFF responde 503.
 */
async function searchOFFByName(name: string, pageSize = 30): Promise<Product[]> {
  const cacheKey = name.trim().toLowerCase();
  const cached = searchMemory.get(cacheKey);
  if (cached && Date.now() - cached.at < SEARCH_MEMORY_TTL_MS) {
    return cached.products;
  }

  try {
    for (let attempt = 0; attempt < SEARCH_MAX_ATTEMPTS; attempt++) {
      const host = OFF_SEARCH_HOSTS[attempt % OFF_SEARCH_HOSTS.length];
      const products = await searchOFFAtHost(host, name, pageSize);

      if (products && products.length > 0) {
        searchMemory.set(cacheKey, { at: Date.now(), products });
        return products;
      }

      if (attempt < SEARCH_MAX_ATTEMPTS - 1) {
        await wait(350 * (attempt + 1));
      }
    }

    if (cached) {
      console.warn('[OFF] Usando última busca em memória após falhas da API');
      return cached.products;
    }

    return [];
  } catch (error) {
    console.warn('[OFF] Erro na busca por nome:', error);
    return cached?.products ?? [];
  }
}

// ─── API Pública ──────────────────────────────────────────────────────────────

/**
 * Busca produto por código de barras (EAN/GTIN).
 * Lógica: Firestore cache → Open Food Facts API → salva cache → retorna
 */
export const fetchProductByBarcode = async (barcode: string): Promise<Product | null> => {
  // 1º: verifica cache Firestore
  const cached = await getFromFirestoreCache(barcode);
  if (cached) {
    console.log(`[Product] Cache HIT: ${barcode}`);
    return cached;
  }

  // 2º: chama Open Food Facts
  console.log(`[Product] Cache MISS — buscando na OFF: ${barcode}`);
  const product = await fetchFromOFF(barcode);
  if (!product) return null;

  // 3º: salva no Firestore para próximas consultas
  await saveToFirestoreCache(product);
  return product;
};

/**
 * Busca produtos por nome, com busca prévia no cache Firestore.
 * Lógica: Firestore cache (busca parcial) → Open Food Facts → merge → retorna
 */
export const fetchProductsByName = async (name: string): Promise<Product[]> => {
  const trimmed = name.trim();
  const nameLower = trimmed.toLowerCase();
  if (nameLower.length < 2) return [];

  // Busca no cache Firestore por nome (prefixo em minúsculas)
  let cached: Product[] = [];
  try {
    const q = query(
      collection(db, 'product_cache'),
      where('name_lower', '>=', nameLower),
      where('name_lower', '<=', nameLower + '\uf8ff'),
      limit(10)
    );
    const snap = await getDocs(q);
    cached = snap.docs.map(d => ({ ...(d.data() as Product), source: 'cache' as const }));
  } catch {
    // Silencia erros de busca no cache — OFF é o fallback
  }

  // Busca na Open Food Facts
  const fromAPI = await searchOFFByName(name);

  // Popula o cache em segundo plano para buscas futuras
  fromAPI.slice(0, 15).forEach((product) => {
    saveToFirestoreCache(product).catch(() => undefined);
  });

  // Merge: cache primeiro, depois resultados da API (sem duplicatas)
  const seen = new Set(cached.map(p => p.barcode));
  const merged = [
    ...cached,
    ...fromAPI.filter(p => !seen.has(p.barcode)),
  ];

  // Ordena por relevância: nome exato primeiro, depois por prefixo
  const query_lower = nameLower;
  merged.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    if (aName === query_lower && bName !== query_lower) return -1;
    if (bName === query_lower && aName !== query_lower) return 1;
    if (aName.startsWith(query_lower) && !bName.startsWith(query_lower)) return -1;
    if (bName.startsWith(query_lower) && !aName.startsWith(query_lower)) return 1;
    return 0;
  });

  return merged;
};

/**
 * Busca imagem de fallback para um produto sem thumbnail.
 * Compatibilidade com o código antigo (addItem.tsx).
 */
export const fetchFallbackImage = async (barcode: string): Promise<string | null> => {
  for (const base of [OFF_PRODUCT_BR, OFF_PRODUCT_WORLD]) {
    try {
      const url = `${base}/api/v2/product/${barcode}.json?fields=image_front_url,image_url`;
      const res = await fetch(url, { headers: OFF_HEADERS });
      if (!res.ok) continue;
      const data = await parseOFFJson<{ product?: { image_front_url?: string; image_url?: string } }>(res);
      const image = data?.product?.image_front_url || data?.product?.image_url;
      if (image) return image;
    } catch {
      // tenta próximo host
    }
  }
  return null;
};
