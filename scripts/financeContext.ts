import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from './firebaseConfig';

export type FinanceCategory = 'Alimentação' | 'Transporte' | 'Outros';

export type FinanceContext = {
  currentMonthKey: string;
  currentMonthLabel: string;
  currentMonthTotal: number;
  previousMonthTotal: number;
  currentMonthItemCount: number;
  estimatedMonthlySpend: number;
  categoryTotals: Record<FinanceCategory, number>;
  monthlyTotals: { monthKey: string; label: string; total: number }[];
  topItems: { name: string; price: number; category: FinanceCategory }[];
};

type ShoppingItem = {
  id: string;
  name?: string;
  price?: string | number;
  quantity?: string | number;
  category?: string;
  createdAt?: any;
  checkedAt?: any;
  checked?: boolean;
};

export type PurchaseItem = {
  sourceItemId?: string;
  name?: string;
  price?: string | number;
  quantity?: string | number;
  total?: number;
  category?: string;
  brand?: string;
  thumbnail?: string;
  checkedAt?: any;
};

export type PurchaseRecord = {
  id: string;
  items?: PurchaseItem[];
  total?: number;
  itemCount?: number;
  finalizedAt?: any;
  createdAt?: any;
  source?: string;
};

const CATEGORY_NAMES: FinanceCategory[] = ['Alimentação', 'Transporte', 'Outros'];

const PURCHASE_CACHE_PREFIX = '@meu-cesto:finalized-purchases:';
const PURCHASE_CACHE_LIMIT = 80;
const FINANCE_CONTEXT_FIRESTORE_TIMEOUT_MS = 3200;

async function withSoftTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    return await Promise.race([
      promise.catch((error) => {
        console.warn('[Finance] Nao foi possivel carregar dados do Firestore.', error);
        return null;
      }),
      timeout,
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function emptyCategories(): Record<FinanceCategory, number> {
  return {
    Alimentação: 0,
    Transporte: 0,
    Outros: 0,
  };
}

function parseMoney(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) return 0;

  const normalized = String(value)
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getQuantity(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  const parsed = Number.parseInt(String(value || '1'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function getShoppingItemTotal(item: Pick<ShoppingItem, 'price' | 'quantity'>): number {
  return parseMoney(item.price) * getQuantity(item.quantity);
}

function getPurchaseItemTotal(item: PurchaseItem): number {
  if (typeof item.total === 'number' && Number.isFinite(item.total)) {
    return item.total;
  }

  return parseMoney(item.price) * getQuantity(item.quantity);
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getPurchaseTime(purchase: PurchaseRecord): number {
  return (toDate(purchase.finalizedAt) || toDate(purchase.createdAt) || new Date(0)).getTime();
}

export function mergePurchaseRecords(
  primaryPurchases: PurchaseRecord[],
  secondaryPurchases: PurchaseRecord[] = []
): PurchaseRecord[] {
  const purchasesById = new Map<string, PurchaseRecord>();

  [...primaryPurchases, ...secondaryPurchases].forEach((purchase) => {
    if (!purchase?.id || purchasesById.has(purchase.id)) return;
    purchasesById.set(purchase.id, purchase);
  });

  return Array.from(purchasesById.values()).sort((a, b) => getPurchaseTime(b) - getPurchaseTime(a));
}

export async function getCachedPurchases(uid: string): Promise<PurchaseRecord[]> {
  try {
    const cached = await AsyncStorage.getItem(`${PURCHASE_CACHE_PREFIX}${uid}`);
    if (!cached) return [];

    const parsed = JSON.parse(cached);
    return Array.isArray(parsed?.purchases)
      ? parsed.purchases.filter((purchase: PurchaseRecord) => purchase?.id)
      : [];
  } catch (error) {
    console.warn('[Finance] Nao foi possivel carregar o cache de compras.', error);
    return [];
  }
}

export async function cacheFinalizedPurchase(uid: string, purchase: PurchaseRecord): Promise<void> {
  try {
    const cachedPurchases = await getCachedPurchases(uid);
    const purchases = mergePurchaseRecords([purchase], cachedPurchases).slice(0, PURCHASE_CACHE_LIMIT);

    await AsyncStorage.setItem(
      `${PURCHASE_CACHE_PREFIX}${uid}`,
      JSON.stringify({
        updatedAt: new Date().toISOString(),
        purchases,
      })
    );
  } catch (error) {
    console.warn('[Finance] Nao foi possivel salvar o cache da compra.', error);
  }
}

function toMonthKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function fromMonthKey(monthKey: string): Date {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function shiftMonth(monthKey: string, amount: number): string {
  const date = fromMonthKey(monthKey);
  date.setMonth(date.getMonth() + amount);
  return toMonthKey(date);
}

function formatMonth(monthKey: string): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(fromMonthKey(monthKey));

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeCategory(category?: string, itemName?: string): FinanceCategory {
  const raw = normalizeText(`${category ?? ''} ${itemName ?? ''}`);

  if (
    raw.includes('transporte') ||
    raw.includes('uber') ||
    raw.includes('onibus') ||
    raw.includes('gasolina') ||
    raw.includes('combustivel')
  ) {
    return 'Transporte';
  }

  if (
    raw.includes('aliment') ||
    raw.includes('mercado') ||
    raw.includes('fruta') ||
    raw.includes('bebida') ||
    raw.includes('padaria') ||
    raw.includes('carne') ||
    raw.includes('leite') ||
    raw.includes('arroz') ||
    raw.includes('feijao')
  ) {
    return 'Alimentação';
  }

  return 'Outros';
}

export function shouldAttachFinanceChart(message: string, context: FinanceContext | null): boolean {
  if (!context || context.currentMonthTotal <= 0) return false;

  const normalized = normalizeText(message);
  return (
    normalized.includes('gasto') ||
    normalized.includes('analise') ||
    normalized.includes('análise') ||
    normalized.includes('categoria') ||
    normalized.includes('mes') ||
    normalized.includes('mês')
  );
}

export async function getUserFinanceContext(uid: string): Promise<FinanceContext> {
  const currentMonthKey = toMonthKey(new Date());
  const previousMonthKey = shiftMonth(currentMonthKey, -1);
  const months = new Map<string, { total: number; itemCount: number; categories: Record<FinanceCategory, number> }>();
  const topItems: { name: string; price: number; category: FinanceCategory }[] = [];

  const shoppingQuery = query(
    collection(db, 'users', uid, 'shopping_list'),
    orderBy('createdAt', 'desc'),
    limit(120)
  );
  const purchasesQuery = query(
    collection(db, 'users', uid, 'purchases'),
    orderBy('finalizedAt', 'desc'),
    limit(120)
  );

  const cachedPurchases = await getCachedPurchases(uid);
  const firestoreResult = await withSoftTimeout(
    Promise.all([
      getDocs(shoppingQuery),
      getDocs(purchasesQuery),
    ]),
    cachedPurchases.length > 0 ? 900 : FINANCE_CONTEXT_FIRESTORE_TIMEOUT_MS
  );

  const items = firestoreResult
    ? firestoreResult[0].docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ShoppingItem[]
    : [];
  const firestorePurchases = firestoreResult
    ? firestoreResult[1].docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as PurchaseRecord[]
    : [];
  const purchases = mergePurchaseRecords(firestorePurchases, cachedPurchases);

  const recordAmount = ({
    name,
    category,
    amount,
    date,
  }: {
    name?: string;
    category?: string;
    amount: number;
    date: Date;
  }) => {
    if (amount <= 0) return;

    const monthKey = toMonthKey(date);
    const normalizedCategory = normalizeCategory(category, name);
    const month = months.get(monthKey) || {
      total: 0,
      itemCount: 0,
      categories: emptyCategories(),
    };

    month.total += amount;
    month.itemCount += 1;
    month.categories[normalizedCategory] += amount;
    months.set(monthKey, month);

    if (monthKey === currentMonthKey) {
      topItems.push({
        name: name || 'Item sem nome',
        price: amount,
        category: normalizedCategory,
      });
    }
  };

  purchases.forEach((purchase) => {
    const date = toDate(purchase.finalizedAt) || toDate(purchase.createdAt) || new Date();

    (purchase.items || []).forEach((item) => {
      recordAmount({
        name: item.name,
        category: item.category,
        amount: getPurchaseItemTotal(item),
        date,
      });
    });
  });

  items.forEach((item) => {
    if (!item.checked) return;

    const date = toDate(item.checkedAt) || toDate(item.createdAt) || new Date();
    recordAmount({
      name: item.name,
      category: item.category,
      amount: getShoppingItemTotal(item),
      date,
    });
  });

  const currentMonth = months.get(currentMonthKey) || {
    total: 0,
    itemCount: 0,
    categories: emptyCategories(),
  };
  const previousMonth = months.get(previousMonthKey) || {
    total: 0,
    itemCount: 0,
    categories: emptyCategories(),
  };

  const monthlyTotals = Array.from({ length: 6 }, (_, index) => {
    const monthKey = shiftMonth(currentMonthKey, index - 5);
    return {
      monthKey,
      label: formatMonth(monthKey),
      total: months.get(monthKey)?.total || 0,
    };
  });

  const estimateBase = [-1, -2, -3]
    .map((offset) => months.get(shiftMonth(currentMonthKey, offset)))
    .filter((month): month is { total: number; itemCount: number; categories: Record<FinanceCategory, number> } =>
      Boolean(month && month.total > 0)
    );

  return {
    currentMonthKey,
    currentMonthLabel: formatMonth(currentMonthKey),
    currentMonthTotal: currentMonth.total,
    previousMonthTotal: previousMonth.total,
    currentMonthItemCount: currentMonth.itemCount,
    estimatedMonthlySpend: estimateBase.length > 0
      ? estimateBase.reduce((sum, month) => sum + month.total, 0) / estimateBase.length
      : 0,
    categoryTotals: CATEGORY_NAMES.reduce((acc, category) => {
      acc[category] = currentMonth.categories[category] || 0;
      return acc;
    }, emptyCategories()),
    monthlyTotals,
    topItems: topItems
      .sort((a, b) => b.price - a.price)
      .slice(0, 8),
  };
}
