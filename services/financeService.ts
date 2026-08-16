import { financeEntryFromOrder, type OrderFinanceEntry } from '../domain/finance';
import type { Order } from '../domain/orders';

export type RefundFinanceEntry = {
  id: string;
  source: 'order_refund';
  sourceKey: string;
  orderId: string;
  amount: number;
  occurredAt: string;
  items: Order['items'];
};

export type FinanceEntry = OrderFinanceEntry | RefundFinanceEntry;

export interface FinanceRepository {
  recordPurchase(entry: OrderFinanceEntry): Promise<void>;
  recordRefund(entry: RefundFinanceEntry): Promise<void>;
}

export function createFinanceService({ repository }: { repository: FinanceRepository }) {
  return {
    async syncOrder(order: Order): Promise<void> {
      if (order.status === 'concluido') {
        await repository.recordPurchase(financeEntryFromOrder(order));
        return;
      }
      if (order.status === 'estornado') {
        await repository.recordRefund({
          id: `refund_${order.id}`,
          source: 'order_refund',
          sourceKey: `order:${order.id}:refund`,
          orderId: order.id,
          amount: -order.totals.total,
          occurredAt: order.updatedAt,
          items: order.items,
        });
      }
    },
  };
}
