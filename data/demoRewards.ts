import type { LoyaltyReward } from '../domain/loyalty';

export const DEMO_LOYALTY_RULE = {
  pointsPerReal: 1,
  disclosure: 'Demonstração: R$ 1 em compras concluídas = 1 ponto. A regra final será definida pelo mercado parceiro.',
};

export const DEMO_REWARDS: LoyaltyReward[] = [
  { id: 'discount-5', title: 'R$ 5 de desconto', description: 'Cupom demonstrativo para a próxima compra.', pointsCost: 50, active: true },
  { id: 'delivery-free', title: 'Entrega grátis', description: 'Remove uma taxa de entrega em um pedido futuro.', pointsCost: 80, active: true },
  { id: 'raffle-entry', title: 'Número da sorte', description: 'Uma participação demonstrativa no sorteio do mercado.', pointsCost: 30, active: true },
];
