const COSMOS_TOKEN = '7EAe7FeO7ITfxELQp-PeXQ';
const BASE_URL = 'https://api.cosmos.bluesoft.com.br';

const DEFAULT_HEADERS = {
  'X-Cosmos-Token': COSMOS_TOKEN,
  'Content-Type': 'application/json',
  'User-Agent': 'Cosmos React Native App',
};

export interface CosmosProduct {
  gtin: number;
  description: string;
  thumbnail?: string;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
  brand?: {
    name: string;
    picture?: string;
  };
  ncm?: {
    code: string;
    description: string;
    full_description?: string;
  };
  gpc?: {
    code: string;
    description: string;
  };
}

export const fetchProductByGtin = async (gtin: string): Promise<CosmosProduct | null> => {
  try {
    const response = await fetch(`${BASE_URL}/gtins/${gtin}.json`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Cosmos API error: ${response.status}`);

    return await response.json();
  } catch (error) {
    console.error('Erro ao buscar produto por GTIN:', error);
    throw error;
  }
};

export const fetchProductsByName = async (
  name: string,
  page = 1,
  perPage = 30
): Promise<CosmosProduct[]> => {
  const params = new URLSearchParams({
    query: name,
    page: String(page),
    per_page: String(Math.min(perPage, 90)),
  });

  const url = `${BASE_URL}/products?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
    });

    console.log(`[Cosmos] Status para "${name}":`, response.status);

    if (response.status === 404) return [];
    if (response.status === 429) {
      console.warn('[Cosmos] Rate limit atingido. Tente novamente mais tarde.');
      return [];
    }
    if (!response.ok) throw new Error(`Cosmos API error: ${response.status}`);

    const data = await response.json();

    if (Array.isArray(data)) return data;
    if (data?.products && Array.isArray(data.products)) return data.products;

    console.warn('[Cosmos] Formato inesperado:', data);
    return [];
  } catch (error) {
    console.error('Erro ao buscar produtos por nome:', error);
    return [];
  }
};