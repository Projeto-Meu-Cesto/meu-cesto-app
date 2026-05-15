const COSMOS_TOKEN = process.env.EXPO_PUBLIC_COSMOS_TOKEN || '';
const BASE_URL = 'https://api.cosmos.bluesoft.com.br';

const DEFAULT_HEADERS: HeadersInit = {
  'X-Cosmos-Token': COSMOS_TOKEN,
  'Content-Type': 'application/json',
};

// Aguarda N milissegundos
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface CosmosProduct {
  gtin: number;
  description: string;
  thumbnail?: string;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
  brand?: { name: string; picture?: string };
  ncm?: { code: string; description: string; full_description?: string };
  gpc?: { code: string; description: string };
}

// Ícones de fallback por categoria (quando não há imagem)
export const CATEGORY_FALLBACK_ICONS: { [key: string]: string } = {
  'frutas': 'nutrition-outline',
  'laticínios': 'water-outline',
  'limpeza': 'sparkles-outline',
  'higiene': 'body-outline',
  'bebidas': 'wine-outline',
  'padaria': 'pizza-outline',
  'carnes': 'fast-food-outline',
  'default': 'cart-outline',
};

export const fetchFallbackImage = async (gtin: number): Promise<string | null> => {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${gtin}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    const imageUrl =
      data?.product?.image_front_url ||
      data?.product?.image_url ||
      data?.product?.selected_images?.front?.display?.pt ||
      null;
    return imageUrl;
  } catch {
    return null;
  }
};

export const fetchProductByGtin = async (gtin: string): Promise<CosmosProduct | null> => {
  if (!COSMOS_TOKEN) {
    return null;
  }

  try {
    const response = await fetch(`${BASE_URL}/gtins/${gtin}.json`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Cosmos API error: ${response.status}`);

    return await response.json();
  } catch {
    console.warn('[Cosmos] Busca por GTIN indisponível. Continuando sem travar o app.');
    return null;
  }
};

export const fetchProductsByName = async (
  name: string,
  page = 1,
  perPage = 30,
  retries = 3        // ← tenta até 3 vezes
): Promise<CosmosProduct[]> => {
  if (!COSMOS_TOKEN) {
    return [];
  }

  const params = new URLSearchParams({
    query: name,
    page: String(page),
    per_page: String(Math.min(perPage, 90)),
  });

  const url = `${BASE_URL}/products?${params.toString()}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: DEFAULT_HEADERS,
      });

      console.log(`[Cosmos] Status para "${name}" (tentativa ${attempt}):`, response.status);

      if (response.status === 404) return [];

      if (response.status === 429) {
        if (attempt < retries) {
          const wait = attempt * 2000; // 2s, 4s, 6s...
          console.warn(`[Cosmos] Rate limit. Aguardando ${wait / 1000}s antes de tentar novamente...`);
          await sleep(wait);
          continue; // tenta de novo
        }
        console.warn('[Cosmos] Rate limit após todas as tentativas.');
        return [];
      }

      if (!response.ok) throw new Error(`Cosmos API error: ${response.status}`);

      const data = await response.json();

      if (Array.isArray(data)) return data;
      if (data?.products && Array.isArray(data.products)) return data.products;

        console.warn('[Cosmos] Formato inesperado na busca de produtos.');
        return [];

    } catch {
      if (attempt === retries) {
        console.warn('[Cosmos] Busca de produtos indisponível. Use o cadastro manual.');
        return [];
      }
      await sleep(attempt * 1000);
    }
  }

  return [];
};
