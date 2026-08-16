import { Radius, Spacing, nestedRadius } from '../../constants/theme';

describe('design system geometry', () => {
  test('uses the approved spacing scale', () => {
    expect(Object.values(Spacing)).toEqual([4, 8, 12, 16, 24, 32, 48, 64]);
  });

  test('uses the approved radius scale', () => {
    expect([Radius.sm, Radius.md, Radius.lg, Radius.xl, Radius.xxl]).toEqual([
      8, 12, 16, 24, 32,
    ]);
  });

  test('derives an outer radius from inner radius and padding', () => {
    expect(nestedRadius(16, 8)).toBe(24);
  });
});
