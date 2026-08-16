import { financeEntryFromOrder } from '../../domain/finance';
import type { Order } from '../../domain/orders';

const completedOrder: Order = {
  id: 'order-1',
  uid: 'user-1',
  marketId: 'demo-market',
  status: 'concluido',
  fulfillment: { mode: 'pickup', pickupSlot: 'Hoje, 18h–19h' },
  payment: { provider: 'demo', status: 'approved', transactionId: 'demo-1' },
  items: [
    {
      productId: 'rice',
      name: 'Arroz 5 kg',
      category: 'Mercearia',
      unitPrice: 25,
      quantity: 1,
    },
  ],
  totals: { subtotal: 25, deliveryFee: 0, discount: 0, total: 25 },
  createdAt: '2026-08-08T12:00:00.000Z',
  updatedAt: '2026-08-08T13:00:00.000Z',
};

describe('finance domain', () => {
  test('creates one stable finance source for a completed order', () => {
    expect(financeEntryFromOrder(completedOrder)).toEqual({
      id: 'order_order-1',
      source: 'order',
      sourceKey: 'order:order-1',
      orderId: 'order-1',
      amount: 25,
      occurredAt: '2026-08-08T13:00:00.000Z',
      items: completedOrder.items,
    });
  });

  test('rejects finance entries for an unfinished order', () => {
    expect(() => financeEntryFromOrder({ ...completedOrder, status: 'em_preparo' })).toThrow(
      'ORDER_NOT_COMPLETED',
    );
  });
});
