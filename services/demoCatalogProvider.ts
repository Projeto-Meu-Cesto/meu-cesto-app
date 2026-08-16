import type { CatalogProvider, CatalogSearch } from '../domain/catalog';
import { demoCatalog } from '../data/demoCatalog';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export const demoCatalogProvider: CatalogProvider = {
  async search(filters: CatalogSearch = {}) {
    const query = normalize(filters.query ?? '');

    return demoCatalog
      .filter((product) => {
        const searchable = normalize(`${product.name} ${product.brand ?? ''}`);
        if (query && !searchable.includes(query)) return false;
        if (filters.category && product.category !== filters.category) return false;
        if (filters.onlyAvailable && (!product.available || product.stockQuantity <= 0)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  },
  async getById(productId: string) {
    return demoCatalog.find((product) => product.id === productId) ?? null;
  },
};
