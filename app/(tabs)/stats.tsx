import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import React, { useState, useMemo } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { getCachedPurchases, mergePurchaseRecords, type PurchaseItem, type PurchaseRecord } from '../../scripts/financeContext';
import { auth, db } from '../../scripts/firebaseConfig';
import { Colors, Spacing, Radius, STATUS_BAR_HEIGHT } from '../../constants/theme';
import {
  parseMoney,
  getQuantity,
  getItemTotal as getShoppingItemTotal,
  toDate,
  toMonthKey,
  shiftMonth,
  formatMonth,
  formatCurrency,
  normalizeText,
} from '../../scripts/utils';

// UI Components
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useSidebar } from '../../components/ui/Sidebar';

const { width } = Dimensions.get('window');
const CACHE_PREFIX = '@meu-cesto:monthly-history:';
const STATS_LOAD_TIMEOUT_MS = 5500;

type CategoryName = 'Frutas' | 'Laticínios' | 'Limpeza' | 'Higiene' | 'Bebidas' | 'Padaria' | 'Carnes' | 'Outros';

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

const CATEGORY_NAMES: CategoryName[] = ['Frutas', 'Laticínios', 'Limpeza', 'Higiene', 'Bebidas', 'Padaria', 'Carnes', 'Outros'];

const CATEGORY_COLORS: Record<CategoryName, string> = {
  Frutas: '#F59E0B',
  'Laticínios': '#3B82F6',
  Limpeza: '#8B5CF6',
  Higiene: '#EC4899',
  Bebidas: '#06B6D4',
  Padaria: '#D97706',
  Carnes: '#EF4444',
  Outros: '#6F766D',
};

const CATEGORY_ICONS: Record<CategoryName, React.ComponentProps<typeof Ionicons>['name']> = {
  Frutas: 'leaf-outline',
  'Laticínios': 'egg-outline',
  Limpeza: 'water-outline',
  Higiene: 'heart-outline',
  Bebidas: 'cafe-outline',
  Padaria: 'restaurant-outline',
  Carnes: 'flame-outline',
  Outros: 'cube-outline',
};

function emptyCategories(): Record<CategoryName, number> {
  return {
    Frutas: 0,
    'Laticínios': 0,
    Limpeza: 0,
    Higiene: 0,
    Bebidas: 0,
    Padaria: 0,
    Carnes: 0,
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

function getPurchaseItemTotal(item: PurchaseItem): number {
  if (typeof item.total === 'number' && Number.isFinite(item.total)) {
    return item.total;
  }
  return parseMoney(item.price) * getQuantity(item.quantity);
}

function normalizeCategory(category?: string, itemName?: string): CategoryName {
  const raw = normalizeText(`${category ?? ''} ${itemName ?? ''}`);
  if (/(banana|maca|maça|uva|morango|laranja|limao|abacaxi|mamao|melancia|fruta)/.test(raw)) return 'Frutas';
  if (/(leite|queijo|iogurte|manteiga|requeijao|laticinio)/.test(raw)) return 'Laticínios';
  if (/(detergente|sabao|amaciante|limpador|desinfetante|esponja|cloro|sanitaria)/.test(raw)) return 'Limpeza';
  if (/(shampoo|sabonete|pasta|escova|desodorante|absorvente)/.test(raw)) return 'Higiene';
  if (/(agua|suco|refrigerante|cerveja|vinho|cafe|cha|energetico|bebida)/.test(raw)) return 'Bebidas';
  if (/(pao|bolo|biscoito|bolacha|rosca|baguete|padaria)/.test(raw)) return 'Padaria';
  if (/(carne|frango|peixe|linguica|presunto|salame|bife|costela)/.test(raw)) return 'Carnes';
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

export default function StatsScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const currentMonthKey = React.useMemo(() => toMonthKey(new Date()), []);
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonthKey);
  const [monthlyHistory, setMonthlyHistory] = React.useState<MonthlySummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [purchasesState, setPurchasesState] = useState<PurchaseRecord[]>([]);
  const [menuVisible, setMenuVisible] = React.useState(false);
  const { setVisible: setSidebarVisible } = useSidebar();
  const [historyVisible, setHistoryVisible] = React.useState(false);
  const [usingCache, setUsingCache] = React.useState(false);
  const [activeTab, setActiveTab] = useState<'Semana' | 'Mês' | 'Ano'>('Mês');

  const handlePreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMonth((prev) => shiftMonth(prev, -1));
  };

  const handleNextMonth = () => {
    if (selectedMonth >= currentMonthKey) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMonth((prev) => shiftMonth(prev, 1));
  };

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
        setPurchasesState(cachedPurchases);
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
      orderBy('finalizedAt', 'desc'),
      limit(120)
    );
    const publishHistory = async () => {
      if (!active || !shoppingLoaded || !purchasesLoaded) return;
      const merged = mergePurchaseRecords(purchases, cachedPurchases);
      setPurchasesState(merged);
      const history = buildMonthlyHistory(
        shoppingItems,
        merged
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

  const historyKeys = React.useMemo(() => {
    const keys = new Set<string>();
    Array.from({ length: 12 }, (_, index) => shiftMonth(currentMonthKey, -index)).forEach((key) => keys.add(key));
    monthlyHistory.forEach((month) => keys.add(month.monthKey));
    keys.add(selectedMonth);
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [currentMonthKey, monthlyHistory, selectedMonth]);

  const openHistory = () => {
    setMenuVisible(false);
    setHistoryVisible(true);
  };

  // Find max category value for layout sizing
  const totalAmount = selectedSummary.total;
  const categoriesList = Object.entries(selectedSummary.categories)
    .map(([name, val]) => ({
      name: name as CategoryName,
      val: val
    }))
    .filter(c => c.val > 0)
    .sort((a, b) => b.val - a.val);

  const realChartData = useMemo(() => {
    const data = Array(12).fill(0);
    purchasesState.forEach((purchase) => {
      const pDate = toDate(purchase.finalizedAt) || toDate(purchase.createdAt);
      if (!pDate) return;
      const monthKey = toMonthKey(pDate);
      if (monthKey !== selectedMonth) return;
      
      const day = pDate.getDate();
      const interval = Math.min(Math.floor((day - 1) / 2.6), 11);
      const amount = (purchase.items || []).reduce((acc, item) => acc + getPurchaseItemTotal(item), 0);
      data[interval] += amount;
    });

    return data;
  }, [purchasesState, selectedMonth]);

  const maxChartValue = Math.max(...realChartData, 1);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* IMAGE 3: HEADER */}
      <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarVisible(true)}>
            <Ionicons name="menu-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Typography variant="caption" weight="heavy" color={Colors.primary} style={styles.topLabel}>
            CLAREZA PARA O SEU CESTO
          </Typography>
          <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Typography variant="display" weight="heavy" color={Colors.textPrimary} style={styles.title}>
          Seus gastos
        </Typography>
        <Typography variant="body" color={Colors.textMuted} style={styles.subtitle}>
          Acompanhe o que importa sem complicar.
        </Typography>

        {/* Month Selector for direct dash month shifting */}
        <MonthSelector
          month={selectedMonth}
          onPrevious={handlePreviousMonth}
          onNext={handleNextMonth}
          canGoNext={selectedMonth < currentMonthKey}
        />

        {/* IMAGE 3: TABS TOGGLE (Semana | Mês | Ano) */}
        <View style={styles.tabsContainer}>
          {(['Semana', 'Mês', 'Ano'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab);
                }}
                style={[styles.tabButton, isActive && styles.tabButtonActive]}
              >
                <Typography variant="body" weight="semibold" color={isActive ? Colors.primary : Colors.textSecondary}>
                  {tab}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <>
            {/* IMAGE 3: GASTOS DESTE MÊS CARD */}
            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              <Card elevated style={styles.totalCard}>
                <Typography variant="caption" weight="bold" color={Colors.textMuted}>
                  TOTAL GASTO · MÊS
                </Typography>
                <Typography variant="display" weight="heavy" color={Colors.textPrimary} style={styles.totalValue}>
                  {formatCurrency(totalAmount)}
                </Typography>
                <View style={styles.trendRow}>
                  <Ionicons name="trending-down" size={14} color={Colors.primary} />
                  <Typography variant="caption" weight="bold" color={Colors.primary}>
                    12% vs. período anterior
                  </Typography>
                </View>

                {/* Custom Daily Bar Chart matching Image 3 */}
                <View style={styles.chartContainer}>
                  <View style={styles.chartBars}>
                    {realChartData.map((val: number, idx: number) => (
                      <View key={idx} style={styles.chartBarWrapper}>
                        <View 
                          style={[
                            styles.chartBarFill, 
                            { 
                              height: Math.max(8, (val / maxChartValue) * 80),
                              backgroundColor: idx === 11 ? '#ffffff' : Colors.primary
                            }
                          ]} 
                        >
                          {idx === 11 && <View style={styles.glowDot} />}
                        </View>
                      </View>
                    ))}
                  </View>
                  <View style={styles.chartLabelsRow}>
                    <Typography variant="caption" color={Colors.textMuted}>01 JUN</Typography>
                    <Typography variant="caption" color={Colors.textMuted}>30 JUN</Typography>
                  </View>
                </View>
              </Card>
            </Animated.View>

            {/* IMAGE 4: POR CATEGORIA SECTION */}
            <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.categorySection}>
              <View style={styles.sectionHeader}>
                <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                  Por categoria
                </Typography>
                <TouchableOpacity onPress={() => router.push('/stats')}>
                  <Typography variant="caption" weight="bold" color={Colors.primary}>
                    Ver tudo
                  </Typography>
                </TouchableOpacity>
              </View>

              {categoriesList.length === 0 ? (
                <Card style={styles.emptyCategoriesCard}>
                  <Ionicons name="basket-outline" size={24} color={Colors.textMuted} />
                  <Typography variant="caption" color={Colors.textMuted} align="center">
                    Nenhum gasto registrado neste mês.
                  </Typography>
                </Card>
              ) : (
                <Card elevated style={styles.categoryListCard}>
                  {categoriesList.map((cat, idx) => {
                    const percent = Math.round((cat.val / (totalAmount || 1)) * 100);
                    return (
                      <View key={cat.name} style={[styles.categoryRow, idx === categoriesList.length - 1 && { borderBottomWidth: 0 }]}>
                        <View style={[styles.categoryIconBg, { backgroundColor: 'rgba(183, 255, 0, 0.1)' }]}>
                          <Ionicons name={CATEGORY_ICONS[cat.name] || 'cube-outline'} size={18} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                            {cat.name}
                          </Typography>
                          <Typography variant="caption" color={Colors.textMuted} style={{ marginTop: 2 }}>
                            {percent}%
                          </Typography>
                        </View>
                        <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                          {formatCurrency(cat.val)}
                        </Typography>
                      </View>
                    );
                  })}
                </Card>
              )}
            </Animated.View>

            {/* IMAGE 4: UM OLHAR DO LUCA */}
            <Animated.View entering={FadeInDown.delay(300).duration(500)}>
              <Card style={styles.lucaLookCard}>
                <View style={styles.lucaLookHeader}>
                  <View style={styles.lucaLookIconBg}>
                    <Ionicons name="sparkles" size={14} color="#080A09" />
                  </View>
                  <Typography variant="caption" weight="bold" color={Colors.primary} style={{ letterSpacing: 0.5 }}>
                    Um olhar do Luca
                  </Typography>
                </View>
                <Typography variant="body" color={Colors.textPrimary} style={styles.lucaLookText}>
                  Alimentação representa a maior parte dos seus gastos neste período.
                </Typography>
              </Card>
            </Animated.View>
          </>
        )}
      </ScrollView>

      {/* Histórico Menu Modal */}
      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={openHistory}>
              <Ionicons name="calendar-number-outline" size={20} color={Colors.textPrimary} />
              <Typography variant="body" weight="semibold" color={Colors.textPrimary}>
                Ver histórico de meses
              </Typography>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* History Selection Modal */}
      <Modal transparent visible={historyVisible} animationType="slide" onRequestClose={() => setHistoryVisible(false)}>
        <View style={styles.historyOverlay}>
          <Pressable style={styles.historyBackdropPressable} onPress={() => setHistoryVisible(false)} />
          <View style={styles.historySheet}>
            <View style={styles.historyHeader}>
              <View>
                <Typography variant="title" weight="bold" color={Colors.textPrimary}>
                  Histórico de meses
                </Typography>
                <Typography variant="caption" color={Colors.textSecondary}>
                  Escolha um mês para analisar
                </Typography>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setHistoryVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
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
                      <Typography variant="body" weight="bold" color={selected ? Colors.primary : Colors.textPrimary}>
                        {formatMonth(monthKey)}
                      </Typography>
                      <Typography variant="caption" color={Colors.textMuted}>
                        {month.itemCount > 0
                          ? `${month.itemCount} itens registrados`
                          : 'Sem dados'}
                      </Typography>
                    </View>
                    <Typography variant="body" weight="heavy" color={selected ? Colors.primary : Colors.textPrimary}>
                      {formatCurrency(month.total)}
                    </Typography>
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

function MonthSelector({
  month,
  onPrevious,
  onNext,
  canGoNext,
}: {
  month: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext: boolean;
}) {
  return (
    <View style={styles.selectorContainer}>
      <TouchableOpacity onPress={onPrevious} style={styles.selectorBtn} accessibilityLabel="Mês anterior">
        <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
      </TouchableOpacity>
      <Typography variant="body" weight="bold" color={Colors.textPrimary} style={styles.selectorText}>
        {formatMonth(month)}
      </Typography>
      <TouchableOpacity
        onPress={onNext}
        disabled={!canGoNext}
        style={[styles.selectorBtn, !canGoNext && styles.selectorBtnDisabled]}
        accessibilityLabel="Próximo mês"
      >
        <Ionicons name="chevron-forward" size={18} color={canGoNext ? Colors.textPrimary : Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: STATUS_BAR_HEIGHT + Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  topLabel: {
    letterSpacing: 0.8,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    marginTop: Spacing.xs,
  },
  subtitle: {
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    padding: 4,
    borderColor: Colors.border,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  tabButtonActive: {
    backgroundColor: '#080A09',
    borderColor: Colors.primary,
    borderWidth: 1,
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  selectorBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectorBtnDisabled: {
    opacity: 0.4,
  },
  selectorText: {
    textTransform: 'capitalize',
  },
  emptyCategoriesCard: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: Colors.border,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  totalCard: {
    borderColor: Colors.border,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  totalValue: {
    marginVertical: Spacing.xs,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.lg,
  },
  chartContainer: {
    marginTop: Spacing.md,
  },
  chartBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 80,
  },
  chartBarWrapper: {
    width: 14,
    height: '100%',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBarFill: {
    width: '100%',
    borderRadius: 4,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  glowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginBottom: 4,
  },
  chartLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  categorySection: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryListCard: {
    padding: 0,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryIconBg: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  lucaLookCard: {
    backgroundColor: '#111A0B',
    borderColor: Colors.primary,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  lucaLookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  lucaLookIconBg: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lucaLookText: {
    marginTop: Spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 130,
    gap: Spacing.xl,
  },
  loadingContainer: {
    paddingVertical: Spacing.xxxxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMonthCard: {
    padding: Spacing.xxl,
    alignItems: 'center',
    borderColor: Colors.border,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  emptyMonthTitle: {
    marginTop: Spacing.xs,
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'flex-end',
    paddingTop: STATUS_BAR_HEIGHT + Spacing.lg,
    paddingRight: Spacing.xl,
  },
  menuCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  historyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  historyBackdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  historySheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xxxl,
    maxHeight: '85%',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyList: {
    gap: Spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyRowActive: {
    borderColor: Colors.primary,
  },
});
