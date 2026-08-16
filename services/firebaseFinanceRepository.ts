import { doc, runTransaction } from 'firebase/firestore';

import { db } from '../scripts/firebaseConfig';
import type { FinanceRepository } from './financeService';

export function createFirebaseFinanceRepository(uid: string): FinanceRepository {
  const financeRef = (entryId: string) => doc(db, 'users', uid, 'finance_entries', entryId);
  const purchaseRef = (orderId: string) => doc(db, 'users', uid, 'purchases', `order_${orderId}`);

  return {
    async recordPurchase(entry) {
      const ledgerRef = financeRef(entry.id);
      const projectionRef = purchaseRef(entry.orderId);
      await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(ledgerRef);
        if (!existing.exists()) transaction.set(ledgerRef, entry);
        transaction.set(projectionRef, {
          id: `order_${entry.orderId}`,
          orderId: entry.orderId,
          source: 'online_order_demo',
          total: entry.amount,
          itemCount: entry.items.reduce((sum, item) => sum + item.quantity, 0),
          finalizedAt: entry.occurredAt,
          createdAt: entry.occurredAt,
          items: entry.items.map((item) => ({
            sourceItemId: item.productId,
            name: item.name,
            price: item.unitPrice,
            quantity: item.quantity,
            total: item.unitPrice * item.quantity,
            category: item.category,
          })),
        });
      });
    },

    async recordRefund(entry) {
      const ledgerRef = financeRef(entry.id);
      const projectionRef = purchaseRef(entry.orderId);
      await runTransaction(db, async (transaction) => {
        const existing = await transaction.get(ledgerRef);
        if (!existing.exists()) transaction.set(ledgerRef, entry);
        transaction.delete(projectionRef);
      });
    },
  };
}
