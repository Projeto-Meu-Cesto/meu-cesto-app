export type DemoPaymentScenario = 'approved' | 'declined';

export type PaymentInput = {
  scenario: DemoPaymentScenario;
  amount: number;
  idempotencyKey: string;
};

export type PaymentResult = {
  provider: 'demo';
  status: 'approved' | 'declined';
  transactionId: string;
  processedAt: string;
  message: string;
};

export interface PaymentProvider {
  process(input: PaymentInput): Promise<PaymentResult>;
}
