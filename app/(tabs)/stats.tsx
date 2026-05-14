import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../../scripts/firebaseConfig';
import { getCachedPurchases, mergePurchaseRecords, type PurchaseItem, type PurchaseRecord } from '../../scripts/financeContext';

const { width } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24)
  : 54;
const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';
const WARNING = '#F59E0B';
const CACHE_PREFIX = '@meu-cesto:monthly-history:';
const STATS_LOAD_TIMEOUT_MS = 5500;

type CategoryName = 'Alimentação' | 'Transporte' | 'Outros';

type MonthlySummary = {
  monthKey: string;
  total: number;
  itemCount: number;
  categories: Record<CategoryName, number>;
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



const CATEGORY_NAMES: CategoryName[] = ['Alimentação', 'Transporte', 'Outros'];

function SkeletonBox({ width: w, height: h, style }: { width?: any; height: number; style?: any }) {
  const opacity = React.useRef(new Animated.Value(0.4)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width: w, height: h, backgroundColor: '#E2E8F0', borderRadius: 10, opacity }, style]}
    />
  );
}

function emptyCategories(): Record<CategoryName, number> {
  return {
    Alimentação: 0,
    Transporte: 0,
    Outros: 0,
  };
}

function createEmptySummary(monthKey: string): MonthlySummary {
  return {
    monthKey,
    total: 0,
    itemCount: 0,
    categories: emptyCategories(),
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

function formatMonth(monthKey: string, style: 'long' | 'short' = 'long'): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: style,
    year: style === 'long' ? 'numeric' : undefined,
  }).format(fromMonthKey(monthKey));

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeCategory(category?: string, itemName?: string): CategoryName {
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

function buildMonthlyHistory(items: ShoppingItem[], purchases: PurchaseRecord[] = []): MonthlySummary[] {
  const map = new Map<string, MonthlySummary>();

  purchases.forEach((purchase) => {
    const date = toDate(purchase.finalizedAt) || toDate(purchase.createdAt) || new Date();
    const monthKey = toMonthKey(date);

    (purchase.items || []).forEach((item) => {
      const amount = getPurchaseItemTotal(item);
      if (amount <= 0) return;

      const summary = map.get(monthKey) || createEmptySummary(monthKey);
      const category = normalizeCategory(item.category, item.name);

      summary.total += amount;
      summary.itemCount += 1;
      summary.categories[category] += amount;
      map.set(monthKey, summary);
    });
  });

  items.forEach((item) => {
    if (!item.checked) return;

    const amount = getShoppingItemTotal(item);
    if (amount <= 0) return;

    const date = toDate(item.checkedAt) || toDate(item.createdAt) || new Date();
    const monthKey = toMonthKey(date);
    const summary = map.get(monthKey) || createEmptySummary(monthKey);
    const category = normalizeCategory(item.category, item.name);

    summary.total += amount;
    summary.itemCount += 1;
    summary.categories[category] += amount;
    map.set(monthKey, summary);
  });

  return Array.from(map.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

function comparisonText(current: number, previous: number): string {
  if (previous <= 0 && current <= 0) return 'Sem gastos no mês anterior';
  if (previous <= 0) return 'Novo mês com gastos registrados';

  const change = ((current - previous) / previous) * 100;
  const prefix = change >= 0 ? '+' : '';
  return `${prefix}${change.toFixed(0)}% vs mês anterior`;
}

export default function StatsScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const currentMonthKey = React.useMemo(() => toMonthKey(new Date()), []);
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonthKey);
  const [monthlyHistory, setMonthlyHistory] = React.useState<MonthlySummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [historyVisible, setHistoryVisible] = React.useState(false);
  const [usingCache, setUsingCache] = React.useState(false);

  React.useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let active = true;
    const cacheKey = `${CACHE_PREFIX}${user.uid}`;
    let shoppingItems: ShoppingItem[] = [];
    let purchases: PurchaseRecord[] = [];
    let cachedPurchases: PurchaseRecord[] = [];
    let shoppingLoaded = false;
    let purchasesLoaded = false;

    const hydrateCache = async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (!cached || !active) return;

        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.months)) {
          setMonthlyHistory(parsed.months);
          setUsingCache(true);
          setLoading(false);
        }
      } catch (error) {
        console.warn('Não foi possível carregar o cache do histórico mensal.', error);
      }
    };

    const hydrateFinalizedPurchases = async () => {
      try {
        cachedPurchases = await getCachedPurchases(user.uid);
        if (!active || cachedPurchases.length === 0) return;

        setMonthlyHistory(buildMonthlyHistory(shoppingItems, cachedPurchases));
        setUsingCache(true);
        setLoading(false);
      } catch (error) {
        console.warn('Nao foi possivel carregar compras finalizadas em cache.', error);
      }
    };

    hydrateCache();
    hydrateFinalizedPurchases();
    const loadingTimer = setTimeout(() => {
      if (active) {
        setLoading(false);
        setUsingCache(true);
      }
    }, STATS_LOAD_TIMEOUT_MS);

    const shoppingQuery = query(
      collection(db, 'users', user.uid, 'shopping_list'),
      orderBy('createdAt', 'desc')
    );
    const purchasesQuery = query(
      collection(db, 'users', user.uid, 'purchases'),
      orderBy('finalizedAt', 'desc')
    );
    const publishHistory = async () => {
      if (!active || !shoppingLoaded || !purchasesLoaded) return;

      const history = buildMonthlyHistory(
        shoppingItems,
        mergePurchaseRecords(purchases, cachedPurchases)
      );

      setMonthlyHistory(history);
      setUsingCache(false);
      setLoading(false);
      clearTimeout(loadingTimer);

      try {
        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify({
            updatedAt: new Date().toISOString(),
            months: history,
          })
        );
      } catch (error) {
        console.warn('Não foi possível salvar o cache do histórico mensal.', error);
      }
    };

    const unsubscribeShopping = onSnapshot(
      shoppingQuery,
      async (snapshot) => {
        shoppingItems = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ShoppingItem[];
        shoppingLoaded = true;
        await publishHistory();
      },
      (error) => {
        console.error('Erro ao carregar lista para histórico mensal:', error);
        if (active) {
          setLoading(false);
          setUsingCache(true);
        }
        clearTimeout(loadingTimer);
      }
    );
    const unsubscribePurchases = onSnapshot(
      purchasesQuery,
      async (snapshot) => {
        purchases = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PurchaseRecord[];
        purchasesLoaded = true;
        await publishHistory();
      },
      (error) => {
        console.error('Erro ao carregar compras finalizadas:', error);
        if (active) {
          setLoading(false);
          setUsingCache(true);
        }
        clearTimeout(loadingTimer);
      }
    );

    return () => {
      active = false;
      clearTimeout(loadingTimer);
      unsubscribeShopping();
      unsubscribePurchases();
    };
  }, [user]);

  const historyMap = React.useMemo(() => {
    return new Map(monthlyHistory.map((month) => [month.monthKey, month]));
  }, [monthlyHistory]);

  const selectedSummary = historyMap.get(selectedMonth) || createEmptySummary(selectedMonth);
  const previousSummary = historyMap.get(shiftMonth(selectedMonth, -1)) || createEmptySummary(shiftMonth(selectedMonth, -1));
  const monthlyEvolution = React.useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const monthKey = shiftMonth(selectedMonth, index - 5);
      return historyMap.get(monthKey) || createEmptySummary(monthKey);
    });
  }, [historyMap, selectedMonth]);
  const maxMonthTotal = Math.max(...monthlyEvolution.map((month) => month.total), 1);
  const maxCategoryTotal = Math.max(...CATEGORY_NAMES.map((name) => selectedSummary.categories[name]), 1);
  const isSelectedCurrentOrFuture = selectedMonth >= currentMonthKey;
  const isMonthEmpty = selectedSummary.total <= 0;
  const estimateBase = [-1, -2, -3]
    .map((offset) => historyMap.get(shiftMonth(selectedMonth, offset)))
    .filter((month): month is MonthlySummary => Boolean(month && month.total > 0));
  const estimatedSpend = estimateBase.length > 0
    ? estimateBase.reduce((sum, month) => sum + month.total, 0) / estimateBase.length
    : 0;
  const historyKeys = React.useMemo(() => {
    const keys = new Set<string>();

    Array.from({ length: 12 }, (_, index) => shiftMonth(currentMonthKey, -index)).forEach((key) => keys.add(key));
    monthlyHistory.forEach((month) => keys.add(month.monthKey));
    keys.add(selectedMonth);

    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [currentMonthKey, monthlyHistory, selectedMonth]);

  const goToPreviousMonth = () => setSelectedMonth((month) => shiftMonth(month, -1));
  const goToNextMonth = () => {
    if (!isSelectedCurrentOrFuture) {
      setSelectedMonth((month) => shiftMonth(month, 1));
    }
  };

  const openHistory = () => {
    setMenuVisible(false);
    setHistoryVisible(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_GREEN} translucent />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ width: 44 }} />
          <Text style={styles.headerTitle}>Finanças</Text>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.monthSwitcher}>
          <TouchableOpacity style={styles.monthButton} onPress={goToPreviousMonth}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.monthTitleWrapper}>
            <Text style={styles.headerDate}>{formatMonth(selectedMonth)}</Text>
            {usingCache && <Text style={styles.cacheLabel}>Dados em cache</Text>}
          </View>
          <TouchableOpacity
            style={[styles.monthButton, isSelectedCurrentOrFuture && styles.monthButtonDisabled]}
            onPress={goToNextMonth}
            disabled={isSelectedCurrentOrFuture}
          >
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Compras confirmadas</Text>
          <Text style={styles.totalValue}>{formatCurrency(selectedSummary.total)}</Text>
          <Text style={styles.totalSubtitle}>{comparisonText(selectedSummary.total, previousSummary.total)}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <>
            <SkeletonBox width="42%" height={12} style={{ marginBottom: 15, borderRadius: 6 }} />
            <SkeletonBox width="100%" height={190} style={{ marginBottom: 30, borderRadius: 24 }} />
            <SkeletonBox width="42%" height={12} style={{ marginBottom: 15, borderRadius: 6 }} />
            <View style={{ flexDirection: 'row', gap: 15, marginBottom: 15 }}>
              <SkeletonBox width={(width - 65) / 2} height={92} style={{ borderRadius: 20 }} />
              <SkeletonBox width={(width - 65) / 2} height={92} style={{ borderRadius: 20 }} />
            </View>
          </>
        ) : (
          <>
            {isMonthEmpty && (
              <View style={styles.emptyMonthCard}>
                <Ionicons name="calendar-outline" size={34} color="#CBD5E1" />
                <Text style={styles.emptyMonthTitle}>Sem compras confirmadas</Text>
                <Text style={styles.emptyMonthText}>
                  Marque itens da lista como comprados para eles entrarem no histórico financeiro.
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>EVOLUÇÃO MENSAL</Text>
            <View style={styles.chartCard}>
              <View style={styles.chartRow}>
                {monthlyEvolution.map((month) => (
                  <Bar
                    key={month.monthKey}
                    amount={month.total}
                    height={(month.total / maxMonthTotal) * 100}
                    label={formatMonth(month.monthKey, 'short').replace('.', '')}
                    active={month.monthKey === selectedMonth}
                  />
                ))}
              </View>
            </View>

            <Text style={styles.sectionTitle}>POR CATEGORIA</Text>
            <View style={styles.categoriesGrid}>
              {CATEGORY_NAMES.slice(0, 2).map((name) => (
                <ProgressCard
                  key={name}
                  label={name}
                  value={formatCurrency(selectedSummary.categories[name])}
                  progress={selectedSummary.categories[name] / maxCategoryTotal}
                  color={PRIMARY_GREEN}
                />
              ))}
            </View>

            <FullProgressCard
              label="Outros"
              value={formatCurrency(selectedSummary.categories.Outros)}
              percent={selectedSummary.total > 0
                ? Math.round((selectedSummary.categories.Outros / selectedSummary.total) * 100)
                : 0}
              progress={selectedSummary.categories.Outros / maxCategoryTotal}
            />

            <View style={styles.estimateCard}>
              <View style={styles.estimateIcon}>
                <Ionicons name="trending-up-outline" size={22} color={WARNING} />
              </View>
              <View style={styles.estimateContent}>
                <Text style={styles.estimateLabel}>Estimativa de gastos</Text>
                <Text style={styles.estimateValue}>
                  {estimatedSpend > 0 ? formatCurrency(estimatedSpend) : 'Sem dados suficientes'}
                </Text>
                <Text style={styles.estimateText}>
                  {estimateBase.length > 0
                    ? `Baseada nos últimos ${estimateBase.length} mês${estimateBase.length > 1 ? 'es' : ''} com gastos.`
                    : 'Registre gastos em meses anteriores para calcular uma média confiável.'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.lucaBtn} onPress={() => router.push('/luca-tab' as any)}>
              <View style={styles.lucaBtnLeft}>
                <View style={styles.lucaIconBg}>
                  <Ionicons name="sparkles" size={20} color={PRIMARY_GREEN} />
                </View>
                <View>
                  <Text style={styles.lucaBtnTitle}>Falar com Luca</Text>
                  <Text style={styles.lucaBtnSub}>Análise inteligente dos seus gastos</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={PRIMARY_GREEN} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={openHistory}>
              <Ionicons name="calendar-number-outline" size={20} color={TEXT_DARK} />
              <Text style={styles.menuItemText}>Ver histórico de meses</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal transparent visible={historyVisible} animationType="slide" onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.historyOverlay}>
          <View style={styles.historySheet}>
            <View style={styles.historyHeader}>
              <View>
                <Text style={styles.historyTitle}>Histórico de meses</Text>
                <Text style={styles.historySubtitle}>Escolha um mês para analisar</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setHistoryVisible(false)}>
                <Ionicons name="close" size={22} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.historyList}>
              {historyKeys.map((monthKey) => {
                const month = historyMap.get(monthKey) || createEmptySummary(monthKey);
                const selected = monthKey === selectedMonth;

                return (
                  <TouchableOpacity
                    key={monthKey}
                    style={[styles.historyRow, selected && styles.historyRowActive]}
                    onPress={() => {
                      setSelectedMonth(monthKey);
                      setHistoryVisible(false);
                    }}
                  >
                    <View>
                      <Text style={[styles.historyMonth, selected && styles.historyMonthActive]}>
                        {formatMonth(monthKey)}
                      </Text>
                      <Text style={styles.historyCount}>
                        {month.itemCount > 0
                          ? `${month.itemCount} item${month.itemCount > 1 ? 's' : ''} registrado${month.itemCount > 1 ? 's' : ''}`
                          : 'Sem dados'}
                      </Text>
                    </View>
                    <Text style={[styles.historyTotal, selected && styles.historyTotalActive]}>
                      {formatCurrency(month.total)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Bar({ height, label, active, amount }: { height: number; label: string; active?: boolean; amount: number }) {
  const safeHeight = Math.max(8, Math.min(100, height || 0));

  return (
    <View style={styles.barWrapper}>
      <Text style={[styles.barValue, active && styles.barValueActive]} numberOfLines={1}>
        {amount > 0 ? formatCurrency(amount).replace('R$', '').trim() : '-'}
      </Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.bar,
            {
              height: `${safeHeight}%` as any,
              backgroundColor: active ? PRIMARY_GREEN : '#94E2C6',
            },
          ]}
        />
      </View>
      <Text style={[styles.barLabel, active && styles.barLabelActive]}>{label}</Text>
    </View>
  );
}

function ProgressCard({ label, value, progress, color }: { label: string; value: string; progress: number; color: string }) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
      <View style={styles.miniBarBg}>
        <View style={[styles.miniBarFill, { width: `${Math.min(progress, 1) * 100}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function FullProgressCard({ label, value, percent, progress }: { label: string; value: string; percent: number; progress: number }) {
  return (
    <View style={styles.fullProgressCard}>
      <View style={styles.fullCardHeader}>
        <Text style={styles.fullCardLabel}>{label}</Text>
        <View style={styles.fullCardValueRow}>
          <Text style={styles.fullCardValue}>{value}</Text>
          <Text style={styles.fullCardPercent}>{percent}%</Text>
        </View>
      </View>
      <View style={styles.fullProgressBarBg}>
        <View style={[styles.fullProgressBarFill, { width: `${Math.min(progress, 1) * 100}%` as any }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingHorizontal: 25,
    paddingTop: STATUS_BAR_HEIGHT,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthButtonDisabled: {
    opacity: 0.35,
  },
  monthTitleWrapper: {
    alignItems: 'center',
    minHeight: 42,
    justifyContent: 'center',
  },
  headerDate: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '800',
    textAlign: 'center',
  },
  cacheLabel: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  totalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  totalLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 5,
  },
  totalValue: {
    fontSize: 35,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 5,
    textAlign: 'center',
  },
  totalSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: 120,
  },
  emptyMonthCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 2,
    borderColor: '#F1F5F9',
    borderStyle: 'dashed',
  },
  emptyMonthTitle: {
    color: TEXT_DARK,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },
  emptyMonthText: {
    color: TEXT_GRAY,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 15,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    height: 205,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  chartRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barWrapper: {
    alignItems: 'center',
    width: Math.max(34, (width - 110) / 6),
  },
  barTrack: {
    height: 122,
    width: 24,
    justifyContent: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 8,
  },
  barValue: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '800',
    marginBottom: 7,
    maxWidth: 42,
  },
  barValueActive: {
    color: PRIMARY_GREEN,
  },
  barLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '800',
    marginTop: 10,
    textTransform: 'capitalize',
  },
  barLabelActive: {
    color: PRIMARY_GREEN,
  },
  categoriesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 15,
  },
  miniCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  miniLabel: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontWeight: '700',
    marginBottom: 4,
  },
  miniValue: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_DARK,
    marginBottom: 12,
  },
  miniBarBg: {
    height: 7,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  fullProgressCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  fullCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  fullCardLabel: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontWeight: '700',
  },
  fullCardValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullCardValue: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  fullCardPercent: {
    fontSize: 14,
    fontWeight: '800',
    color: PRIMARY_GREEN,
  },
  fullProgressBarBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
  },
  fullProgressBarFill: {
    height: '100%',
    backgroundColor: '#A7F3D0',
    borderRadius: 4,
  },
  estimateCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  estimateIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFBEB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  estimateContent: {
    flex: 1,
  },
  estimateLabel: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontWeight: '800',
    marginBottom: 2,
  },
  estimateValue: {
    fontSize: 19,
    color: TEXT_DARK,
    fontWeight: '900',
  },
  estimateText: {
    fontSize: 12,
    color: TEXT_GRAY,
    lineHeight: 17,
    marginTop: 4,
    fontWeight: '600',
  },
  lucaBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  lucaBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  lucaIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lucaBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  lucaBtnSub: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontWeight: '500',
    marginTop: 2,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    alignItems: 'flex-end',
    paddingTop: STATUS_BAR_HEIGHT + 62,
    paddingRight: 25,
  },
  menuCard: {
    width: 235,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  menuItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  menuItemText: {
    color: TEXT_DARK,
    fontWeight: '800',
    fontSize: 14,
  },
  historyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  historySheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 22,
    maxHeight: '82%',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyTitle: {
    color: TEXT_DARK,
    fontSize: 20,
    fontWeight: '900',
  },
  historySubtitle: {
    color: TEXT_GRAY,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyList: {
    paddingBottom: 28,
    gap: 10,
  },
  historyRow: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyRowActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#A7F3D0',
  },
  historyMonth: {
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: '900',
  },
  historyMonthActive: {
    color: PRIMARY_GREEN,
  },
  historyCount: {
    color: TEXT_GRAY,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  historyTotal: {
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: '900',
  },
  historyTotalActive: {
    color: PRIMARY_GREEN,
  },
});
