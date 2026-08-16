import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';

import { canTransitionOrder, type Order, type OrderStatus } from '../domain/orders';
import { db } from '../scripts/firebaseConfig';
import type { OrderRepository } from './orderService';

export type OrderEvent = {
  id: string;
  status: OrderStatus;
  createdAt: string;
  type: 'created' | 'status';
};

export type UserCommerceRepository = OrderRepository & {
  subscribeOrders(callback: (orders: Order[]) => void, onError?: (error: Error) => void): Unsubscribe;
  subscribeOrder(orderId: string, callback: (order: Order | null) => void, onError?: (error: Error) => void): Unsubscribe;
  subscribeOrderEvents(orderId: string, callback: (events: OrderEvent[]) => void, onError?: (error: Error) => void): Unsubscribe;
};

export function createUserCommerceRepository(uid: string): UserCommerceRepository {
  const ordersCollection = collection(db, 'users', uid, 'orders');
  const orderRef = (orderId: string) => doc(db, 'users', uid, 'orders', orderId);
  const eventRef = (orderId: string, eventId: string) => doc(db, 'users', uid, 'orders', orderId, 'events', eventId);

  return {
    async create(order) {
      if (order.uid !== uid) throw new Error('ORDER_OWNER_MISMATCH');
      const ref = orderRef(order.id);
      await runTransaction(db, async (transaction) => {
        const current = await transaction.get(ref);
        if (current.exists()) return;
        transaction.set(ref, order);
        transaction.set(eventRef(order.id, `created_${order.status}`), {
          id: `created_${order.status}`,
          status: order.status,
          type: 'created',
          createdAt: order.createdAt,
        } satisfies OrderEvent);
      });
      const created = await getDoc(ref);
      return { id: created.id, ...created.data() } as Order;
    },

    async getById(orderId) {
      const snapshot = await getDoc(orderRef(orderId));
      return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Order) : null;
    },

    async transition(orderId, nextStatus, updatedAt) {
      const ref = orderRef(orderId);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error('ORDER_NOT_FOUND');
        const current = { id: snapshot.id, ...snapshot.data() } as Order;
        if (!canTransitionOrder(current.status, nextStatus)) throw new Error('INVALID_ORDER_TRANSITION');
        transaction.update(ref, {
          status: nextStatus,
          updatedAt,
          ...(nextStatus === 'estornado' ? { 'payment.status': 'refunded' } : {}),
        });
        const id = `status_${nextStatus}_${updatedAt.replace(/\W/g, '')}`;
        transaction.set(eventRef(orderId, id), { id, status: nextStatus, type: 'status', createdAt: updatedAt } satisfies OrderEvent);
      });
      const updated = await getDoc(ref);
      return { id: updated.id, ...updated.data() } as Order;
    },

    subscribeOrders(callback, onError) {
      return onSnapshot(
        query(ordersCollection, orderBy('createdAt', 'desc'), limit(50)),
        (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Order))),
        onError,
      );
    },

    subscribeOrder(orderId, callback, onError) {
      return onSnapshot(
        orderRef(orderId),
        (snapshot) => callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Order) : null),
        onError,
      );
    },

    subscribeOrderEvents(orderId, callback, onError) {
      const events = collection(db, 'users', uid, 'orders', orderId, 'events');
      return onSnapshot(
        query(events, orderBy('createdAt', 'asc')),
        (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as OrderEvent))),
        onError,
      );
    },
  };
}
