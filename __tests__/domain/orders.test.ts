import {
  calculateOrderTotals,
  canTransitionOrder,
  type OrderItem,
} from '../../domain/orders';

describe('order domain', () => {
  test('includes delivery fee and discount in the final total', () => {
    const items: Pick<OrderItem, 'unitPrice' | 'quantity'>[] = [
      { unitPrice: 7.5, quantity: 2 },
      { unitPrice: 4, quantity: 1 },
    ];

    expect(calculateOrderTotals(items, 5, 3)).toEqual({
      subtotal: 19,
      deliveryFee: 5,
      discount: 3,
      total: 21,
    });
  });

  test('never returns a negative order total', () => {
    expect(calculateOrderTotals([{ unitPrice: 5, quantity: 1 }], 0, 10).total).toBe(0);
  });

  test('allows only explicit status transitions', () => {
    expect(canTransitionOrder('confirmado', 'em_preparo')).toBe(true);
    expect(canTransitionOrder('confirmado', 'concluido')).toBe(false);
    expect(canTransitionOrder('recusado', 'confirmado')).toBe(false);
  });
});
