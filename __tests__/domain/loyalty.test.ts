import {
  calculateEarnedPoints,
  sumLoyaltyBalance,
  type LoyaltyEntry,
} from '../../domain/loyalty';

describe('loyalty domain', () => {
  test('rounds earned points down to an integer', () => {
    expect(calculateEarnedPoints(103.8, { pointsPerReal: 1 })).toBe(103);
    expect(calculateEarnedPoints(25, { pointsPerReal: 0.5 })).toBe(12);
  });

  test('separates pending points from available balance', () => {
    const entries: LoyaltyEntry[] = [
      { id: 'pending', kind: 'earn', status: 'pending', points: 103, sourceKey: 'order:1' },
      { id: 'available', kind: 'release', status: 'available', points: 20, sourceKey: 'order:2' },
      { id: 'redeemed', kind: 'redeem', status: 'available', points: -5, sourceKey: 'reward:1' },
    ];

    expect(sumLoyaltyBalance(entries)).toEqual({ pending: 103, available: 15 });
  });
});
