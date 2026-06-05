/**
 * utils.ts — Funções utilitárias compartilhadas do Meu Cesto.
 *
 * Centraliza funções que estavam duplicadas em home.tsx, lists.tsx,
 * stats.tsx e financeContext.ts, eliminando inconsistências de bugs.
 */

// ─── Dinheiro ─────────────────────────────────────────────────────────────────

/**
 * Converte string ou number em float seguro (R$ 4.950,00 → 4950.00).
 * Suporta formatos pt-BR e en-US.
 */
export function parseMoney(value: string | number | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;

  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')        // remove R$, espaços, etc.
    .replace(/\.(?=\d{3}(\D|$))/g, '') // remove ponto separador de milhar
    .replace(',', '.');              // vírgula decimal → ponto

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Converte string ou number em quantidade inteira positiva (mínimo 1).
 */
export function getQuantity(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 1;
  }
  const parsed = Number.parseInt(String(value || '1'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * Retorna preço × quantidade de um item.
 */
export function getItemTotal(item: { price?: string | number; quantity?: string | number }): number {
  return parseMoney(item.price) * getQuantity(item.quantity);
}

/**
 * Formata número em BRL (R$ 1.234,56).
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value || 0);
}

// ─── Normalização de input ────────────────────────────────────────────────────

/**
 * Normaliza preço durante digitação: remove não-dígitos exceto vírgula,
 * limita a 2 casas decimais.
 */
export function normalizePriceTyping(value: string): string {
  const clean = value.replace(/[^\d,.]/g, '').replace(/\./g, ',');
  const [whole, ...decimalParts] = clean.split(',');
  if (decimalParts.length === 0) return whole;
  return `${whole},${decimalParts.join('').slice(0, 2)}`;
}

/**
 * Normaliza preço para salvar no Firestore ("4,99" → "4.99" ou "4,99" como string).
 * Retorna string vazia se inválido.
 */
export function normalizePriceForStorage(value: string): string {
  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed.toFixed(2).replace('.', ',')
    : '';
}

/**
 * Remove não-dígitos e limita a 3 caracteres (para campo de quantidade).
 */
export function normalizeQuantityTyping(value: string): string {
  return value.replace(/[^\d]/g, '').slice(0, 3);
}

/**
 * Formata valor monetário para exibição em input ("4.99" → "4,99").
 */
export function formatPriceForInput(value: string | number | undefined): string {
  const amount = parseMoney(value);
  return amount > 0 ? amount.toFixed(2).replace('.', ',') : '';
}

// ─── Datas e Meses ────────────────────────────────────────────────────────────

/**
 * Converte qualquer valor em Date (Firestore Timestamp, seconds, string, Date).
 * Retorna null se não for possível converter.
 */
export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof (value as any).toDate === 'function') return (value as any).toDate();
  if (typeof (value as any).seconds === 'number') return new Date((value as any).seconds * 1000);
  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Converte Date em chave de mês ("2026-06").
 */
export function toMonthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

/**
 * Converte chave de mês em Date (primeiro dia do mês).
 */
export function fromMonthKey(monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

/**
 * Avança ou recua monthKey por N meses.
 */
export function shiftMonth(monthKey: string, amount: number): string {
  const date = fromMonthKey(monthKey);
  date.setMonth(date.getMonth() + amount);
  return toMonthKey(date);
}

/**
 * Formata monthKey em texto legível pt-BR ("Junho de 2026").
 * @param style 'long' = "Junho de 2026" | 'short' = "jun"
 */
export function formatMonth(monthKey: string, style: 'long' | 'short' = 'long'): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: style,
    year: style === 'long' ? 'numeric' : undefined,
  }).format(fromMonthKey(monthKey));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// ─── Texto ────────────────────────────────────────────────────────────────────

/**
 * Remove acentos e converte para minúsculas (para comparações).
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/** Promise que resolve após N milissegundos. */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
