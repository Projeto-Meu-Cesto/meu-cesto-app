import { createFirebaseLoyaltyRepository } from './firebaseLoyaltyRepository';
import { createFirebaseFinanceRepository } from './firebaseFinanceRepository';
import { createFinanceService } from './financeService';
import { createLoyaltyService } from './loyaltyService';
import { createOrderService } from './orderService';
import { createUserCommerceRepository } from './userCommerceRepository';

export function createUserOrderWorkflow(uid: string) {
  const repository = createUserCommerceRepository(uid);
  const loyalty = createLoyaltyService({ repository: createFirebaseLoyaltyRepository(uid) });
  const finance = createFinanceService({ repository: createFirebaseFinanceRepository(uid) });
  return {
    repository,
    loyalty,
    finance,
    orders: createOrderService({
      repository,
      onOrderChanged: async (order) => {
        await Promise.all([loyalty.syncOrder(order), finance.syncOrder(order)]);
      },
    }),
  };
}
