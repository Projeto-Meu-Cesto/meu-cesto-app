import { getLucaFailureFallback } from '../../domain/aiFallback';

describe('Luca transparent fallback', () => {
  test.each(['missing_configuration', 'quota', 'network'] as const)(
    'does not fabricate values after %s',
    (reason) => {
      const response = getLucaFailureFallback(reason, 'Quanto eu gastei este mês?', null);
      expect(response).toMatch(/não|ainda/i);
      expect(response).not.toMatch(/R\$\s*\d/);
    },
  );
});
