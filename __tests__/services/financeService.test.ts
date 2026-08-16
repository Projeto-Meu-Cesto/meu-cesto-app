import type { Order } from '../../domain/orders';
import type { FinanceEntry } from '../../services/financeService';
import { createFinanceService, type FinanceRepository } from '../../services/financeService';

function makeOrder(status: Order['status']): Order {
  return {
    id: 'order-1', uid: 'user-1', marketId: 'market-demo', status,
    fulfillment: { mode: 'pickup', pickupSlot: 'Hoje, 18h' },
    payment: { provider: 'demo', status: status === 'estornado' ? 'refunded' : 'approved' },
    items: [{ productId: 'p1', name: 'Arroz', category: 'Mercearia', unitPrice: 20, quantity: 2 }],
    totals: { subtotal: 40, deliveryFee: 0, discount: 0, total: 40 },
    createdAt: '2026-08-08T12:00:00.000Z', updatedAt: '2026-08-08T13:00:00.000Z',
  };
}

function memoryRepository(): FinanceRepository & { entries: Map<string, FinanceEntry>; purchases: Set<string> } {
  const entries = new Map<string, FinanceEntry>();
  const purchases = new Set<string>();
  return {
    entries,
    purchases,
    async recordPurchase(entry) { entries.set(entry.id, entries.get(entry.id) ?? entry); purchases.add(entry.orderId); },
    async recordRefund(entry) { entries.set(entry.id, entries.get(entry.id) ?? entry); purchases.delete(entry.orderId); },
  };
}

describe('finance service', () => {
  test('projects a completed order once into purchases', async () => {
    const repository = memoryRepository();
    const service = createFinanceService({ repository });

    await service.syncOrder(makeOrder('concluido'));
    await service.syncOrder(makeOrder('concluido'));

    expect(repository.entries.size).toBe(1);
    expect(repository.purchases.has('order-1')).toBe(true);
  });

  test('records an idempotent negative reversal and removes the purchase projection', async () => {
    const repository = memoryRepository();
    const service = createFinanceService({ repository });
    await service.syncOrder(makeOrder('concluido'));

    await service.syncOrder(makeOrder('estornado'));
    await service.syncOrder(makeOrder('estornado'));

    expect(repository.entries.get('refund_order-1')?.amount).toBe(-40);
    expect(repository.entries.size).toBe(2);
    expect(repository.purchases.has('order-1')).toBe(false);
  });

  test('ignores orders that have not been completed', async () => {
    const repository = memoryRepository();
    const service = createFinanceService({ repository });
    await service.syncOrder(makeOrder('em_preparo'));
    expect(repository.entries.size).toBe(0);
  });
});
