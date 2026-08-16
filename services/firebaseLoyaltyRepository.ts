import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';

import { sumLoyaltyBalance, type LoyaltyEntry, type LoyaltyReward } from '../domain/loyalty';
import { db } from '../scripts/firebaseConfig';
import type { LoyaltyRepository } from './loyaltyService';

type LoyaltyBalance = { pending: number; available: number };

export type FirebaseLoyaltyRepository = LoyaltyRepository & {
  subscribeEntries(callback: (entries: LoyaltyEntry[]) => void, onError?: (error: Error) => void): Unsubscribe;
  subscribeBalance(callback: (balance: LoyaltyBalance) => void, onError?: (error: Error) => void): Unsubscribe;
};

export function createFirebaseLoyaltyRepository(uid: string): FirebaseLoyaltyRepository {
  const ledger = collection(db, 'users', uid, 'loyalty_ledger');
  const summaryRef = doc(db, 'users', uid, 'loyalty_summary', 'current');
  const entryRef = (entryId: string) => doc(db, 'users', uid, 'loyalty_ledger', entryId);

  return {
    async applyEntries(entries) {
      if (entries.length === 0) return;
      await runTransaction(db, async (transaction) => {
        const summarySnapshot = await transaction.get(summaryRef);
        const entrySnapshots = await Promise.all(entries.map((entry) => transaction.get(entryRef(entry.id))));
        const fresh = entries.filter((_, index) => !entrySnapshots[index].exists());
        if (fresh.length === 0) return;
        const delta = sumLoyaltyBalance(fresh);
        const current = summarySnapshot.exists()
          ? summarySnapshot.data() as LoyaltyBalance
          : { pending: 0, available: 0 };

        fresh.forEach((entry) => transaction.set(entryRef(entry.id), entry));
        transaction.set(summaryRef, {
          pending: current.pending + delta.pending,
          available: current.available + delta.available,
          updatedAt: fresh[fresh.length - 1].createdAt,
        });
      });
    },

    async getEntries() {
      const snapshot = await getDocs(query(ledger, orderBy('createdAt', 'desc')));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as LoyaltyEntry));
    },

    async redeem(reward: LoyaltyReward, entry: LoyaltyEntry) {
      const redemptionRef = doc(db, 'users', uid, 'redemptions', entry.id);
      await runTransaction(db, async (transaction) => {
        const summarySnapshot = await transaction.get(summaryRef);
        const existing = await transaction.get(redemptionRef);
        if (existing.exists()) return;
        const current = summarySnapshot.exists()
          ? summarySnapshot.data() as LoyaltyBalance
          : { pending: 0, available: 0 };
        if (current.available < reward.pointsCost) throw new Error('INSUFFICIENT_POINTS');
        transaction.set(entryRef(entry.id), entry);
        transaction.set(redemptionRef, {
          id: entry.id,
          rewardId: reward.id,
          title: reward.title,
          pointsCost: reward.pointsCost,
          status: 'issued_demo',
          createdAt: entry.createdAt,
        });
        transaction.set(summaryRef, {
          pending: current.pending,
          available: current.available - reward.pointsCost,
          updatedAt: entry.createdAt,
        });
      });
    },

    subscribeEntries(callback, onError) {
      return onSnapshot(
        query(ledger, orderBy('createdAt', 'desc')),
        (snapshot) => callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as LoyaltyEntry))),
        onError,
      );
    },

    subscribeBalance(callback, onError) {
      return onSnapshot(
        summaryRef,
        (snapshot) => callback(snapshot.exists() ? snapshot.data() as LoyaltyBalance : { pending: 0, available: 0 }),
        onError,
      );
    },
  };
}
