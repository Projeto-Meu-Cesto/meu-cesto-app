import type { DemoPaymentScenario, PaymentProvider } from '../domain/payment';
import type { Order, OrderItem, OrderStatus } from '../domain/orders';
import { calculateOrderTotals, canTransitionOrder } from '../domain/orders';
import { demoPaymentProvider } from './demoPaymentProvider';

export interface OrderRepository {
  create(order: Order): Promise<Order>;
  getById(orderId: string): Promise<Order | null>;
  transition(orderId: string, nextStatus: OrderStatus, updatedAt: string): Promise<Order>;
}

export type CreateOrderInput = {
  uid: string;
  marketId: string;
  items: OrderItem[];
  fulfillment: Order['fulfillment'];
  paymentScenario: DemoPaymentScenario;
  deliveryFee?: number;
  discount?: number;
};

type OrderServiceDependencies = {
  repository: OrderRepository;
  paymentProvider?: PaymentProvider;
  now?: () => string;
  createId?: () => string;
  onOrderChanged?: (order: Order) => Promise<void>;
};

export function createOrderService(dependencies: OrderServiceDependencies) {
  const paymentProvider = dependencies.paymentProvider ?? demoPaymentProvider;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? (() => `order-${Date.now()}`);

  return {
    async create(input: CreateOrderInput): Promise<Order> {
      const id = createId();
      const createdAt = now();
      const totals = calculateOrderTotals(
        input.items,
        input.deliveryFee ?? 0,
        input.discount ?? 0,
      );
      const payment = await paymentProvider.process({
        scenario: input.paymentScenario,
        amount: totals.total,
        idempotencyKey: id,
      });
      const order: Order = {
        id,
        uid: input.uid,
        marketId: input.marketId,
        status: payment.status === 'approved' ? 'confirmado' : 'recusado',
        fulfillment: input.fulfillment,
        payment: {
          provider: 'demo',
          status: payment.status,
          transactionId: payment.transactionId,
        },
        items: input.items.map((item) => ({ ...item })),
        totals,
        createdAt,
        updatedAt: createdAt,
      };
      const created = await dependencies.repository.create(order);
      await dependencies.onOrderChanged?.(created);
      return created;
    },
    async transition(orderId: string, nextStatus: OrderStatus): Promise<Order> {
      const order = await dependencies.repository.getById(orderId);
      if (!order) throw new Error('ORDER_NOT_FOUND');
      if (!canTransitionOrder(order.status, nextStatus)) {
        throw new Error('INVALID_ORDER_TRANSITION');
      }
      const updated = await dependencies.repository.transition(orderId, nextStatus, now());
      await dependencies.onOrderChanged?.(updated);
      return updated;
    },
  };
}
