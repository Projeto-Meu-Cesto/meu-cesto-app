import type { Order, OrderStatus } from '../../domain/orders';
import { createOrderService, type OrderRepository } from '../../services/orderService';

function memoryRepository(): OrderRepository & { orders: Map<string, Order> } {
  const orders = new Map<string, Order>();
  return {
    orders,
    async create(order) {
      orders.set(order.id, order);
      return order;
    },
    async getById(orderId) {
      return orders.get(orderId) ?? null;
    },
    async transition(orderId, nextStatus, updatedAt) {
      const current = orders.get(orderId);
      if (!current) throw new Error('ORDER_NOT_FOUND');
      const updated = { ...current, status: nextStatus, updatedAt };
      orders.set(orderId, updated);
      return updated;
    },
  };
}

const item = {
  productId: 'rice',
  name: 'Arroz 5 kg',
  category: 'Mercearia',
  unitPrice: 25,
  quantity: 2,
};

describe('order service', () => {
  test('creates a confirmed pickup order after demo approval', async () => {
    const repository = memoryRepository();
    const service = createOrderService({
      repository,
      now: () => '2026-08-08T14:00:00.000Z',
      createId: () => 'order-1',
    });

    const order = await service.create({
      uid: 'user-1',
      marketId: 'demo-market',
      items: [item],
      fulfillment: { mode: 'pickup', pickupSlot: 'Hoje, 18h–19h' },
      paymentScenario: 'approved',
    });

    expect(order.status).toBe('confirmado');
    expect(order.payment.status).toBe('approved');
    expect(order.totals.total).toBe(50);
    expect(repository.orders.get('order-1')).toEqual(order);
  });

  test('persists a declined order without allowing progress', async () => {
    const repository = memoryRepository();
    const service = createOrderService({ repository, now: () => '2026-08-08T14:00:00.000Z', createId: () => 'order-2' });
    const order = await service.create({
      uid: 'user-1', marketId: 'demo-market', items: [item],
      fulfillment: { mode: 'pickup', pickupSlot: 'Hoje, 18h–19h' }, paymentScenario: 'declined',
    });

    expect(order.status).toBe('recusado');
    await expect(service.transition(order.id, 'confirmado')).rejects.toThrow('INVALID_ORDER_TRANSITION');
  });

  test('rejects a status jump that skips preparation', async () => {
    const repository = memoryRepository();
    const service = createOrderService({ repository, now: () => '2026-08-08T14:00:00.000Z', createId: () => 'order-3' });
    const order = await service.create({
      uid: 'user-1', marketId: 'demo-market', items: [item],
      fulfillment: { mode: 'delivery', address: 'Rua Exemplo, 100' }, paymentScenario: 'approved',
    });

    await expect(service.transition(order.id, 'concluido' as OrderStatus)).rejects.toThrow('INVALID_ORDER_TRANSITION');
  });

  test('notifies the commerce workflow after create and transition', async () => {
    const repository = memoryRepository();
    const onOrderChanged = jest.fn(async () => undefined);
    const service = createOrderService({ repository, onOrderChanged, now: () => '2026-08-08T14:00:00.000Z', createId: () => 'order-4' });
    const order = await service.create({
      uid: 'user-1', marketId: 'demo-market', items: [item],
      fulfillment: { mode: 'pickup', pickupSlot: 'Hoje, 18h' }, paymentScenario: 'approved',
    });
    const updated = await service.transition(order.id, 'em_preparo');

    expect(onOrderChanged).toHaveBeenNthCalledWith(1, order);
    expect(onOrderChanged).toHaveBeenNthCalledWith(2, updated);
  });
});
