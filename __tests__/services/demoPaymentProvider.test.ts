import { demoPaymentProvider } from '../../services/demoPaymentProvider';

describe('demo payment provider', () => {
  test.each([
    ['approved', 'approved'],
    ['declined', 'declined'],
  ] as const)('maps the %s scenario to %s', async (scenario, expected) => {
    await expect(demoPaymentProvider.process({
      scenario,
      amount: 49.9,
      idempotencyKey: `checkout-${scenario}`,
    })).resolves.toMatchObject({
      provider: 'demo',
      status: expected,
      transactionId: `demo_checkout-${scenario}`,
    });
  });
});
