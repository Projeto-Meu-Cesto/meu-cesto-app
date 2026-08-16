import type { Order, OrderItem } from './orders';

export type OrderFinanceEntry = {
  id: string;
  source: 'order';
  sourceKey: string;
  orderId: string;
  amount: number;
  occurredAt: string;
  items: OrderItem[];
};

export function financeEntryFromOrder(order: Order): OrderFinanceEntry {
  if (order.status !== 'concluido') {
    throw new Error('ORDER_NOT_COMPLETED');
  }

  return {
    id: `order_${order.id}`,
    source: 'order',
    sourceKey: `order:${order.id}`,
    orderId: order.id,
    amount: order.totals.total,
    occurredAt: order.updatedAt,
    items: order.items,
  };
}
