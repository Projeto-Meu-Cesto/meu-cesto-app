import type { PaymentProvider } from '../domain/payment';

export const demoPaymentProvider: PaymentProvider = {
  async process(input) {
    const status = input.scenario === 'approved' ? 'approved' : 'declined';
    return {
      provider: 'demo',
      status,
      transactionId: `demo_${input.idempotencyKey}`,
      processedAt: new Date().toISOString(),
      message: status === 'approved'
        ? 'Pagamento aprovado no ambiente de demonstração.'
        : 'Pagamento recusado no ambiente de demonstração.',
    };
  },
};
