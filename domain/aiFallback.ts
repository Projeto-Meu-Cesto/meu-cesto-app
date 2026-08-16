import type { FinanceContext } from '../scripts/financeContext';

export type LucaFailureReason = 'missing_configuration' | 'quota' | 'network';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function currency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export function getLucaFailureFallback(
  reason: LucaFailureReason,
  message: string,
  context?: FinanceContext | null,
): string {
  const normalized = normalize(message);

  if (context && (normalized.includes('gasto') || normalized.includes('analise') || normalized.includes('mes'))) {
    const categoryEntries = Object.entries(context.categoryTotals).sort((a, b) => b[1] - a[1]);
    const [topCategory, topValue] = categoryEntries[0] || ['Outros', 0];

    if (context.currentMonthTotal <= 0) {
      return '**Análise do mês**\n\nAinda não tenho compras confirmadas neste mês. Adicione itens com preço na lista e marque como comprados para eu calcular total, categorias e tendência.';
    }

    return `**Análise do mês**\n\nVocê confirmou **${currency(context.currentMonthTotal)}** em compras neste mês.\n\n- Categoria principal: **${topCategory}** (${currency(topValue)})\n- Compras confirmadas: **${context.currentMonthItemCount}**\n- Estimativa mensal: **${context.estimatedMonthlySpend > 0 ? currency(context.estimatedMonthlySpend) : 'sem dados suficientes'}**\n\nAção prática: revise os itens de ${topCategory} antes da próxima lista.`;
  }

  if (reason === 'missing_configuration') {
    return 'A IA online ainda não está habilitada neste ambiente. Mesmo assim, posso fazer análises básicas com os dados salvos no Meu Cesto.';
  }

  return reason === 'quota'
    ? 'Não foi possível usar a IA porque o limite gratuito foi alcançado agora. Posso continuar com uma análise local baseada somente nos dados salvos no app.'
    : 'Não consegui acessar a IA agora. Posso continuar com uma análise local baseada somente nos dados salvos no app.';
}
