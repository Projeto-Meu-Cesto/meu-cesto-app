export type LoyaltyRule = {
  pointsPerReal: number;
};

export type LoyaltyEntry = {
  id: string;
  kind: 'earn' | 'release' | 'redeem' | 'reverse';
  status: 'pending' | 'available';
  points: number;
  sourceKey: string;
  description?: string;
  createdAt?: string;
};

export type LoyaltyReward = {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  active: boolean;
};

export function calculateEarnedPoints(total: number, rule: LoyaltyRule): number {
  return Math.max(0, Math.floor(total * rule.pointsPerReal));
}

export function sumLoyaltyBalance(entries: LoyaltyEntry[]): {
  pending: number;
  available: number;
} {
  return entries.reduce(
    (balance, entry) => {
      if (entry.status === 'pending') {
        balance.pending += entry.points;
      } else {
        balance.available += entry.points;
      }
      return balance;
    },
    { pending: 0, available: 0 },
  );
}
