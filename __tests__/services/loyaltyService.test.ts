import type { Order } from '../../domain/orders';
import type { LoyaltyEntry, LoyaltyReward } from '../../domain/loyalty';
import { createLoyaltyService, type LoyaltyRepository } from '../../services/loyaltyService';

function makeOrder(status: Order['status']): Order {
  return {
    id: 'order-1',
    uid: 'user-1',
    marketId: 'market-demo',
    status,
    fulfillment: { mode: 'pickup', pickupSlot: 'Hoje, 18h' },
    payment: { provider: 'demo', status: 'approved' },
    items: [{ productId: 'p1', name: 'Arroz', category: 'Mercearia', unitPrice: 20, quantity: 2 }],
    totals: { subtotal: 40, deliveryFee: 0, discount: 0, total: 40 },
    createdAt: '2026-08-08T12:00:00.000Z',
    updatedAt: '2026-08-08T12:00:00.000Z',
  };
}

function createMemoryRepository(): LoyaltyRepository & { entries: Map<string, LoyaltyEntry> } {
  const entries = new Map<string, LoyaltyEntry>();
  return {
    entries,
    async applyEntries(nextEntries) {
      nextEntries.forEach((entry) => entries.set(entry.id, entries.get(entry.id) ?? entry));
    },
    async getEntries() {
      return [...entries.values()];
    },
    async redeem(reward, entry) {
      const available = [...entries.values()]
        .filter((item) => item.status === 'available')
        .reduce((sum, item) => sum + item.points, 0);
      if (available < reward.pointsCost) throw new Error('INSUFFICIENT_POINTS');
      entries.set(entry.id, entry);
    },
  };
}

describe('loyalty service', () => {
  test('creates pending points once for an approved order', async () => {
    const repository = createMemoryRepository();
    const service = createLoyaltyService({ repository, now: () => '2026-08-08T13:00:00.000Z' });

    await service.syncOrder(makeOrder('confirmado'));
    await service.syncOrder(makeOrder('confirmado'));

    expect(await service.getBalance()).toEqual({ pending: 40, available: 0 });
    expect(repository.entries.size).toBe(1);
  });

  test('releases pending points on completion and reverses them after refund', async () => {
    const repository = createMemoryRepository();
    const service = createLoyaltyService({ repository, now: () => '2026-08-08T13:00:00.000Z' });

    await service.syncOrder(makeOrder('concluido'));
    expect(await service.getBalance()).toEqual({ pending: 0, available: 40 });

    await service.syncOrder(makeOrder('estornado'));
    expect(await service.getBalance()).toEqual({ pending: 0, available: 0 });
  });

  test('removes pending points when an order is cancelled', async () => {
    const repository = createMemoryRepository();
    const service = createLoyaltyService({ repository, now: () => '2026-08-08T13:00:00.000Z' });

    await service.syncOrder(makeOrder('cancelado'));

    expect(await service.getBalance()).toEqual({ pending: 0, available: 0 });
  });

  test('redeems a reward only when the available balance is sufficient', async () => {
    const repository = createMemoryRepository();
    const service = createLoyaltyService({ repository, createId: () => 'redemption-1', now: () => '2026-08-08T13:00:00.000Z' });
    const reward: LoyaltyReward = { id: 'discount-5', title: 'R$ 5 de desconto', description: 'No próximo pedido', pointsCost: 30, active: true };

    await service.syncOrder(makeOrder('concluido'));
    await service.redeem(reward);

    expect(await service.getBalance()).toEqual({ pending: 0, available: 10 });
    await expect(service.redeem({ ...reward, id: 'discount-10', pointsCost: 20 })).rejects.toThrow('INSUFFICIENT_POINTS');
  });
});
