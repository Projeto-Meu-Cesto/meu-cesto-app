import {
  calculateEarnedPoints,
  sumLoyaltyBalance,
  type LoyaltyEntry,
  type LoyaltyReward,
} from '../domain/loyalty';
import type { Order } from '../domain/orders';

export interface LoyaltyRepository {
  applyEntries(entries: LoyaltyEntry[]): Promise<void>;
  getEntries(): Promise<LoyaltyEntry[]>;
  redeem(reward: LoyaltyReward, entry: LoyaltyEntry): Promise<void>;
}

type LoyaltyServiceDependencies = {
  repository: LoyaltyRepository;
  now?: () => string;
  createId?: () => string;
  pointsPerReal?: number;
};

function orderEntries(order: Order, pointsPerReal: number, createdAt: string): LoyaltyEntry[] {
  if (!['confirmado', 'em_preparo', 'pronto_retirada', 'em_entrega', 'concluido', 'cancelado', 'estornado'].includes(order.status)) {
    return [];
  }

  const points = calculateEarnedPoints(order.totals.total, { pointsPerReal });
  const sourceKey = `order:${order.id}`;
  const earn: LoyaltyEntry = {
    id: `${sourceKey}:earn`,
    kind: 'earn',
    status: 'pending',
    points,
    sourceKey,
    description: `Pontos do pedido #${order.id.slice(-6).toUpperCase()}`,
    createdAt,
  };

  if (['confirmado', 'em_preparo', 'pronto_retirada', 'em_entrega'].includes(order.status)) return [earn];

  const removePending: LoyaltyEntry = {
    id: `${sourceKey}:remove-pending`,
    kind: 'reverse',
    status: 'pending',
    points: -points,
    sourceKey,
    description: 'Baixa dos pontos pendentes',
    createdAt,
  };

  if (order.status === 'cancelado') return [earn, removePending];

  const release: LoyaltyEntry = {
    id: `${sourceKey}:release`,
    kind: 'release',
    status: 'available',
    points,
    sourceKey,
    description: 'Pontos liberados após a conclusão',
    createdAt,
  };

  if (order.status === 'concluido') return [earn, removePending, release];

  return [
    earn,
    removePending,
    release,
    {
      id: `${sourceKey}:refund`,
      kind: 'reverse',
      status: 'available',
      points: -points,
      sourceKey,
      description: 'Pontos revertidos pelo estorno',
      createdAt,
    },
  ];
}

export function createLoyaltyService(dependencies: LoyaltyServiceDependencies) {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? (() => `redemption-${Date.now()}`);
  const pointsPerReal = dependencies.pointsPerReal ?? 1;

  return {
    async syncOrder(order: Order): Promise<void> {
      await dependencies.repository.applyEntries(orderEntries(order, pointsPerReal, now()));
    },
    async getBalance() {
      return sumLoyaltyBalance(await dependencies.repository.getEntries());
    },
    async redeem(reward: LoyaltyReward): Promise<void> {
      if (!reward.active) throw new Error('REWARD_INACTIVE');
      const balance = sumLoyaltyBalance(await dependencies.repository.getEntries());
      if (balance.available < reward.pointsCost) throw new Error('INSUFFICIENT_POINTS');
      const id = createId();
      await dependencies.repository.redeem(reward, {
        id,
        kind: 'redeem',
        status: 'available',
        points: -reward.pointsCost,
        sourceKey: `reward:${reward.id}`,
        description: reward.title,
        createdAt: now(),
      });
    },
  };
}
