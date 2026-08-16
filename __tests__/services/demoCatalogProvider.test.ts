import { demoCatalogProvider } from '../../services/demoCatalogProvider';

describe('demo catalog provider', () => {
  test('searches names without depending on accents', async () => {
    const result = await demoCatalogProvider.search({ query: 'feijao', onlyAvailable: true });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((product) => product.available)).toBe(true);
    expect(result[0].name).toMatch(/Feijão/i);
  });

  test('filters a category and excludes unavailable products', async () => {
    const result = await demoCatalogProvider.search({
      category: 'Hortifruti',
      onlyAvailable: true,
    });

    expect(result.length).toBeGreaterThan(1);
    expect(result.every((product) => product.category === 'Hortifruti')).toBe(true);
    expect(result.every((product) => product.stockQuantity > 0)).toBe(true);
  });
});
