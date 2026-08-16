import { cartReducer, createCartState, getCartTotals } from '../../domain/cart';
import type { CatalogProduct } from '../../domain/catalog';

const rice: CatalogProduct = {
  id: 'rice',
  marketId: 'demo-market',
  name: 'Arroz 5 kg',
  category: 'Mercearia',
  unit: 'pacote',
  price: 25,
  stockQuantity: 3,
  available: true,
  updatedAt: '2026-08-08T00:00:00.000Z',
};

describe('cart domain', () => {
  test('merges repeated products and never exceeds stock', () => {
    const first = cartReducer(createCartState('demo-market'), { type: 'add', product: rice });
    const merged = cartReducer(first, { type: 'add', product: rice, quantity: 5 });

    expect(merged.items).toEqual([{ product: rice, quantity: 3 }]);
  });

  test('removes an item when quantity becomes zero', () => {
    const first = cartReducer(createCartState('demo-market'), { type: 'add', product: rice });
    const empty = cartReducer(first, { type: 'setQuantity', productId: rice.id, quantity: 0 });

    expect(empty.items).toEqual([]);
  });

  test('calculates quantity and subtotal from cart items', () => {
    const state = cartReducer(createCartState('demo-market'), {
      type: 'add',
      product: rice,
      quantity: 2,
    });

    expect(getCartTotals(state)).toEqual({ itemCount: 2, subtotal: 50 });
  });
});
