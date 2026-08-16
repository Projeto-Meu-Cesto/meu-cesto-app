import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';
import Animated, { 
  FadeInUp, 
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { Colors, Spacing, Radius, STATUS_BAR_HEIGHT } from '../../constants/theme';
import { getCachedPurchases, mergePurchaseRecords, type PurchaseRecord } from '../../scripts/financeContext';
import { auth, db } from '../../scripts/firebaseConfig';
import { getItemTotal, getQuantity, parseMoney, toDate, toMonthKey, wait } from '../../scripts/utils';
import { useToast } from '../../context/ToastContext';

// UI Design System Components
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { useSidebar } from '../../components/ui/Sidebar';

const { width, height: windowHeight } = Dimensions.get('window');
const HOME_LOAD_TIMEOUT_MS = 4500;

type ShoppingListItem = {
  id: string;
  name?: string;
  price?: string | number;
  quantity?: string | number;
  color?: string;
  checked?: boolean;
  category?: string;
  createdAt?: any;
  checkedAt?: any;
};

type HomeNotification = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  color: string;
  actionLabel?: string;
  action?: () => void;
};

type ListSummary = {
  total: number;
  checked: number;
  pending: number;
  estimated: number;
  spent: number;
  confirmed: number;
};

function getPurchaseItemTotal(item: NonNullable<PurchaseRecord['items']>[number]) {
  if (typeof item.total === 'number' && Number.isFinite(item.total)) {
    return item.total;
  }
  return parseMoney(item.price) * getQuantity(item.quantity);
}

function buildListSummary(items: ShoppingListItem[], purchases: PurchaseRecord[]): ListSummary {
  const currentMonthKey = toMonthKey(new Date());
  const checkedItems = items.filter(item => item.checked);
  const purchasedSourceIds = new Set<string>();
  let spent = 0;
  let confirmed = 0;

  purchases.forEach((purchase) => {
    const purchaseDate = toDate(purchase.finalizedAt) || toDate(purchase.createdAt) || new Date();
    if (toMonthKey(purchaseDate) !== currentMonthKey) return;

    (purchase.items || []).forEach((item) => {
      const amount = getPurchaseItemTotal(item);
      if (amount <= 0) return;
      if (item.sourceItemId) {
        purchasedSourceIds.add(item.sourceItemId);
      }
      spent += amount;
      confirmed += 1;
    });
  });

  checkedItems.forEach((item) => {
    if (purchasedSourceIds.has(item.id)) return;
    const amount = getItemTotal(item);
    if (amount <= 0) return;
    spent += amount;
    confirmed += 1;
  });

  const estimated = items.reduce((acc, item) => acc + getItemTotal(item), 0);

  return {
    total: items.length,
    checked: checkedItems.length,
    pending: items.length - checkedItems.length,
    estimated,
    spent,
    confirmed,
  };
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function usePressAnimation() {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressIn = () => {
    scale.value = withSpring(0.96, { damping: 10, stiffness: 300 });
  };
  const pressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  return { animatedStyle, pressIn, pressOut };
}

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const { showToast } = useToast();
  const { setVisible: setSidebarVisible } = useSidebar();
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [listSummary, setListSummary] = useState<ListSummary>({
    total: 0,
    checked: 0,
    pending: 0,
    estimated: 0,
    spent: 0,
    confirmed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const [dismissedInsight, setDismissedInsight] = useState(false);

  const refreshHomeData = React.useCallback(async () => {
    if (!user) return;
    setIsRefreshing(true);
    try {
      const shoppingQuery = query(
        collection(db, 'users', user.uid, 'shopping_list'),
        orderBy('createdAt', 'desc')
      );
      const purchasesQuery = query(
        collection(db, 'users', user.uid, 'purchases'),
        orderBy('finalizedAt', 'desc'),
        limit(120)
      );

      const [listSnap, purchasesSnap, cachedPurchases] = await Promise.all([
        getDocs(shoppingQuery),
        getDocs(purchasesQuery),
        getCachedPurchases(user.uid),
      ]);

      const shoppingItems = listSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ShoppingListItem[];

      const firestorePurchases = purchasesSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PurchaseRecord[];

      const merged = mergePurchaseRecords(firestorePurchases, cachedPurchases);
      setPurchases(merged);
      setListSummary(buildListSummary(shoppingItems, merged));
      setDataVersion((v) => v + 1);
    } catch (e) {
      console.warn('Erro ao atualizar dados da Home', e);
    } finally {
      setIsRefreshing(false);
    }
    await wait(350);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let active = true;
    let shoppingItems: ShoppingListItem[] = [];
    let firestorePurchases: PurchaseRecord[] = [];
    let cachedPurchases: PurchaseRecord[] = [];

    const publishSummary = () => {
      if (!active) return;
      const merged = mergePurchaseRecords(firestorePurchases, cachedPurchases);
      setPurchases(merged);
      setListSummary(buildListSummary(shoppingItems, merged));
      setLoading(false);
    };

    getCachedPurchases(user.uid)
      .then((mergedPurchases) => {
        cachedPurchases = mergedPurchases;
        if (mergedPurchases.length > 0) {
          publishSummary();
        }
      })
      .catch((error) => {
        console.warn('Nao foi possivel carregar compras finalizadas em cache.', error);
      });

    const shoppingQuery = query(
      collection(db, 'users', user.uid, 'shopping_list'),
      orderBy('createdAt', 'desc')
    );
    const purchasesQuery = query(
      collection(db, 'users', user.uid, 'purchases'),
      orderBy('finalizedAt', 'desc'),
      limit(120)
    );
    let receivedSnapshot = false;
    const loadingTimer = setTimeout(() => {
      if (!receivedSnapshot && active) {
        publishSummary();
      }
    }, HOME_LOAD_TIMEOUT_MS);

    const unsubList = onSnapshot(
      shoppingQuery,
      (snapshot) => {
        receivedSnapshot = true;
        clearTimeout(loadingTimer);
        shoppingItems = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ShoppingListItem[];
        publishSummary();
      },
      (error) => {
        console.error('Erro ao carregar resumo da lista:', error);
        receivedSnapshot = true;
        clearTimeout(loadingTimer);
        publishSummary();
      }
    );

    const unsubPurchases = onSnapshot(
      purchasesQuery,
      (snapshot) => {
        firestorePurchases = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as PurchaseRecord[];
        publishSummary();
      },
      (error) => {
        console.error('Erro ao carregar compras finalizadas:', error);
        publishSummary();
      }
    );

    return () => {
      active = false;
      clearTimeout(loadingTimer);
      unsubList();
      unsubPurchases();
    };
  }, [user, dataVersion]);

  const realChartData = useMemo(() => {
    const data = Array(12).fill(0);
    const now = new Date();
    const msInDay = 24 * 60 * 60 * 1000;

    purchases.forEach((purchase) => {
      const pDate = toDate(purchase.finalizedAt) || toDate(purchase.createdAt);
      if (!pDate) return;
      const diffDays = Math.floor((now.getTime() - pDate.getTime()) / msInDay);
      if (diffDays >= 0 && diffDays < 12) {
        const amount = (purchase.items || []).reduce((acc, item) => acc + getPurchaseItemTotal(item), 0);
        data[11 - diffDays] += amount;
      }
    });

    const sum = data.reduce((a, b) => a + b, 0);
    if (sum === 0) {
      return Array(12).fill(0);
    }
    return data;
  }, [purchases]);

  const maxChartValue = Math.max(...realChartData, 1);

  const { currentMonthSpent, previousMonthSpent } = useMemo(() => {
     const now = new Date();
     const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
     const prevMonthKey = toMonthKey(prevDate);
     
     let prev = 0;
     purchases.forEach(purchase => {
       const pDate = toDate(purchase.finalizedAt) || toDate(purchase.createdAt);
       if (!pDate) return;
       if (toMonthKey(pDate) === prevMonthKey) {
         const amount = (purchase.items || []).reduce((acc, item) => acc + getPurchaseItemTotal(item), 0);
         prev += amount;
       }
     });

     return { currentMonthSpent: listSummary.spent, previousMonthSpent: prev };
  }, [purchases, listSummary.spent]);

  const trendPercentage = previousMonthSpent > 0 
    ? Math.round(((currentMonthSpent - previousMonthSpent) / previousMonthSpent) * 100) 
    : 0;
  const trendDiff = currentMonthSpent - previousMonthSpent;

  const smartInsight = useMemo(() => {
    if (!purchases || purchases.length === 0) return null;

    const itemCounts: Record<string, number> = {};
    const itemDays: Record<string, number[]> = {};

    purchases.forEach(purchase => {
      const pDate = toDate(purchase.finalizedAt) || toDate(purchase.createdAt);
      if (!pDate) return;
      const dayOfWeek = pDate.getDay();

      (purchase.items || []).forEach(item => {
         if (!item.name) return;
         const name = item.name.toLowerCase().trim();
         itemCounts[name] = (itemCounts[name] || 0) + 1;
         if (!itemDays[name]) itemDays[name] = [];
         itemDays[name].push(dayOfWeek);
      });
    });

    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
    if (sortedItems.length === 0) return null;
    
    const topItemName = sortedItems[0][0];
    const count = sortedItems[0][1];

    if (count < 2) return null;

    const days = itemDays[topItemName];
    const dayCounts: Record<number, number> = {};
    days.forEach(d => dayCounts[d] = (dayCounts[d] || 0) + 1);
    const mostCommonDay = parseInt(Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0][0]);

    const daysOfWeek = ['aos domingos', 'às segundas', 'às terças', 'às quartas', 'às quintas', 'às sextas', 'aos sábados'];
    const dayName = daysOfWeek[mostCommonDay];
    
    const formattedItemName = topItemName.charAt(0).toUpperCase() + topItemName.slice(1);

    return {
      item: formattedItemName,
      day: dayName,
      message: `Você costuma comprar ${topItemName} ${dayName}.`,
    };
  }, [purchases]);

  const handleAddInsightItem = async () => {
      if (!user || !smartInsight) return;
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await addDoc(collection(db, 'users', user.uid, 'shopping_list'), {
          name: smartInsight.item,
          quantity: '1 un',
          checked: false,
          createdAt: serverTimestamp(),
        });
        showToast('Produto adicionado à lista!', 'success');
        setDismissedInsight(true);
      } catch (e) {
        console.error(e);
        showToast('Erro ao adicionar produto.', 'error');
      }
  };

  const button1Anim = usePressAnimation();
  const button2Anim = usePressAnimation();
  const button3Anim = usePressAnimation();
  const button4Anim = usePressAnimation();
  const button5Anim = usePressAnimation();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refreshHomeData}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
              <TouchableOpacity
                style={styles.menuButton}
                onPress={() => setSidebarVisible(true)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Abrir menu"
              >
                <Ionicons name="menu-outline" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <View>
                <Typography variant="title" weight="bold" color={Colors.textPrimary} style={styles.headerTitle}>
                  Olá, {user?.displayName ? user.displayName.split(' ')[0] : 'Guilherme'}
                </Typography>
                <Typography variant="body" color={Colors.textMuted}>
                  Vamos economizar hoje?
                </Typography>
              </View>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity 
                style={styles.notificationCircle} 
                onPress={() => router.push('/notifications')}
                accessibilityRole="button"
                accessibilityLabel="Ver notificações"
              >
                <Ionicons name="notifications-outline" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <View style={styles.mainContent}>
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <Card elevated style={styles.spendingCard}>
              <View style={styles.spendingHeader}>
                <Typography variant="caption" weight="bold" color={Colors.textMuted}>
                  GASTOS DESTE MÊS
                </Typography>
                {previousMonthSpent > 0 && (
                  <View style={[styles.trendLabel, trendPercentage > 0 && { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                    <Typography variant="caption" weight="bold" color={trendPercentage > 0 ? Colors.error : Colors.primary}>
                      {trendPercentage > 0 ? '↗' : '↘'} {Math.abs(trendPercentage)}%
                    </Typography>
                  </View>
                )}
              </View>
              <Typography variant="display" weight="heavy" color={Colors.textPrimary} style={styles.spendingAmount}>
                {formatCurrency(currentMonthSpent)}
              </Typography>
              <View style={styles.spendingSubtitleRow}>
                <Typography variant="caption" color={Colors.textMuted}>
                  comparado ao mês anterior
                </Typography>
                <Typography variant="caption" weight="bold" color={trendDiff > 0 ? Colors.error : Colors.primary}>
                  {trendDiff === 0 
                    ? 'Mesmo valor' 
                    : `${trendDiff > 0 ? '+' : '-'} R$ ${Math.abs(trendDiff).toFixed(2).replace('.', ',')} ${trendDiff > 0 ? 'acima' : 'abaixo'}`}
                </Typography>
              </View>
              <View style={styles.miniChartContainer}>
                {realChartData.map((val, idx) => (
                  <View 
                    key={idx} 
                    style={[
                      styles.miniChartBar, 
                      { 
                        height: Math.max(10, (val / maxChartValue) * 35), 
                        backgroundColor: Colors.primary 
                      }
                    ]} 
                  />
                ))}
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <View style={styles.sectionHeader}>
              <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                Próxima compra
              </Typography>
              <TouchableOpacity onPress={() => router.push('/lists')}>
                <Typography variant="caption" weight="bold" color={Colors.primary}>
                  Ver lista
                </Typography>
              </TouchableOpacity>
            </View>

            <Card elevated style={styles.nextPurchaseCard}>
              <View style={styles.nextPurchaseHeader}>
                <View style={styles.purchaseIconContainer}>
                  <Ionicons name="basket" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                    Lista da semana
                  </Typography>
                  <Typography variant="caption" color={Colors.textMuted}>
                    {listSummary.checked}/{listSummary.total} itens organizados
                  </Typography>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Typography variant="body" weight="heavy" color={Colors.primary}>
                    {formatCurrency(listSummary.estimated || 0)}
                  </Typography>
                  <Typography variant="caption" color={Colors.textMuted}>
                    estimativa
                  </Typography>
                </View>
              </View>

              <ProgressBar 
                progress={listSummary.total > 0 ? listSummary.checked / listSummary.total : 0} 
                color={Colors.primary} 
                height={6} 
              />
              
              <View style={styles.percentRow}>
                <Typography variant="caption" color={Colors.textSecondary}>
                  {listSummary.total > 0 ? Math.round((listSummary.checked / listSummary.total) * 100) : 0}% concluida
                </Typography>
              </View>

              <Animated.View style={button1Anim.animatedStyle}>
                <Pressable
                  onPressIn={button1Anim.pressIn}
                  onPressOut={button1Anim.pressOut}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/lists');
                  }}
                  style={styles.continueButton}
                >
                  <Ionicons name="arrow-forward" size={18} color="#080A09" style={{ marginRight: 6 }} />
                  <Typography variant="body" weight="bold" color="#080A09">
                    Continuar lista
                  </Typography>
                </Pressable>
              </Animated.View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            <Typography variant="body" weight="bold" color={Colors.textPrimary} style={styles.sectionLabel}>
              Ações rápidas
            </Typography>

            <View style={styles.quickActionsGrid}>
              <Animated.View style={[styles.gridCell, button2Anim.animatedStyle]}>
                <Pressable
                  onPressIn={button2Anim.pressIn}
                  onPressOut={button2Anim.pressOut}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/catalog');
                  }}
                  style={styles.gridPressable}
                >
                  <View style={styles.gridIconCircle}>
                    <Ionicons name="add" size={20} color={Colors.primary} />
                  </View>
                  <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                    Comprar online
                  </Typography>
                  <Typography variant="caption" color={Colors.textMuted}>
                    Catálogo do mercado
                  </Typography>
                </Pressable>
              </Animated.View>

              <Animated.View style={[styles.gridCell, button3Anim.animatedStyle]}>
                <Pressable
                  onPressIn={button3Anim.pressIn}
                  onPressOut={button3Anim.pressOut}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/lists');
                  }}
                  style={styles.gridPressable}
                >
                  <View style={styles.gridIconCircle}>
                    <Ionicons name="list" size={20} color={Colors.primary} />
                  </View>
                  <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                    Nova lista
                  </Typography>
                  <Typography variant="caption" color={Colors.textMuted}>
                    Para o fim de semana
                  </Typography>
                </Pressable>
              </Animated.View>

              <Animated.View style={[styles.gridCell, button4Anim.animatedStyle]}>
                <Pressable
                  onPressIn={button4Anim.pressIn}
                  onPressOut={button4Anim.pressOut}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/stats');
                  }}
                  style={styles.gridPressable}
                >
                  <View style={styles.gridIconCircle}>
                    <Ionicons name="card-outline" size={20} color={Colors.primary} />
                  </View>
                  <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                    Registrar gasto
                  </Typography>
                  <Typography variant="caption" color={Colors.textMuted}>
                    R$ 0,00
                  </Typography>
                </Pressable>
              </Animated.View>

              <Animated.View style={[styles.gridCell, button5Anim.animatedStyle]}>
                <Pressable
                  onPressIn={button5Anim.pressIn}
                  onPressOut={button5Anim.pressOut}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/luca');
                  }}
                  style={styles.gridPressable}
                >
                  <View style={styles.gridIconCircle}>
                    <Ionicons name="star" size={20} color={Colors.primary} />
                  </View>
                  <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                    Perguntar ao Luca
                  </Typography>
                  <Typography variant="caption" color={Colors.textMuted}>
                    Seu copiloto
                  </Typography>
                </Pressable>
              </Animated.View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(360).duration(500)} style={styles.shortcutStack}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/orders')}
              style={styles.ordersShortcut}
            >
              <View style={styles.ordersShortcutIcon}>
                <Ionicons name="receipt-outline" size={24} color={Colors.primary} />
              </View>
              <View style={styles.ordersShortcutCopy}>
                <Typography variant="title" weight="semibold">Meus pedidos</Typography>
                <Typography variant="caption" color={Colors.textSecondary}>Acompanhe retirada, entrega e histórico</Typography>
              </View>
              <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/rewards')}
              style={styles.ordersShortcut}
            >
              <View style={styles.ordersShortcutIcon}>
                <Ionicons name="gift-outline" size={24} color={Colors.primary} />
              </View>
              <View style={styles.ordersShortcutCopy}>
                <Typography variant="title" weight="semibold">Clube Meu Cesto</Typography>
                <Typography variant="caption" color={Colors.textSecondary}>Pontos, benefícios e extrato</Typography>
              </View>
              <Ionicons name="chevron-forward" size={22} color={Colors.textMuted} />
            </Pressable>
          </Animated.View>

          {smartInsight && !dismissedInsight && (
            <Animated.View entering={FadeInDown.delay(400).duration(500)}>
              <Typography variant="body" weight="bold" color={Colors.textPrimary} style={styles.sectionLabel}>
                Insight inteligente
              </Typography>

              <Card style={styles.insightNotedCard}>
                <View style={styles.notedHeader}>
                  <View style={styles.notedIcon}>
                    <Ionicons name="star" size={14} color="#080A09" />
                  </View>
                  <Typography variant="caption" weight="heavy" color={Colors.primary} style={{ letterSpacing: 0.5 }}>
                    LUCA NOTOU
                  </Typography>
                </View>
                <Typography variant="body" weight="bold" color={Colors.textPrimary} style={styles.notedTitle}>
                  {smartInsight.message}
                </Typography>
                <Typography variant="body" color={Colors.textSecondary} style={styles.notedSubtitle}>
                  Quer adicionar à próxima lista?
                </Typography>
                <View style={styles.notedActions}>
                  <TouchableOpacity
                    onPress={handleAddInsightItem}
                    style={styles.notedAddBtn}
                    activeOpacity={0.8}
                  >
                    <Typography variant="body" weight="bold" color="#080A09">
                      + Adicionar
                    </Typography>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setDismissedInsight(true);
                    }}
                    style={styles.notedDismissBtn}
                    activeOpacity={0.8}
                  >
                    <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                      Agora não
                    </Typography>
                  </TouchableOpacity>
                </View>
              </Card>
            </Animated.View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 130,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: STATUS_BAR_HEIGHT + Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
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
  headerTitle: {
    marginBottom: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  notificationCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mainContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  spendingCard: {
    padding: Spacing.xl,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  spendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  trendLabel: {
    backgroundColor: 'rgba(183, 255, 0, 0.1)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  spendingAmount: {
    marginBottom: Spacing.xs,
  },
  spendingSubtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  miniChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 35,
    marginTop: Spacing.sm,
  },
  miniChartBar: {
    width: 14,
    borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  nextPurchaseCard: {
    borderColor: Colors.border,
    borderWidth: 1,
    gap: Spacing.md,
  },
  nextPurchaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  purchaseIconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(183, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentRow: {
    marginTop: -Spacing.xs,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: Radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabel: {
    marginBottom: Spacing.md,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  shortcutStack: {
    gap: Spacing.md,
  },
  ordersShortcut: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
  },
  ordersShortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(183, 255, 0, 0.08)',
  },
  ordersShortcutCopy: {
    flex: 1,
  },
  gridCell: {
    width: (width - 48 - Spacing.md) / 2,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  gridPressable: {
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  gridIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(183, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  insightNotedCard: {
    backgroundColor: '#111A0B',
    borderColor: Colors.primary,
    borderWidth: 1,
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  notedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  notedIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notedTitle: {
    marginTop: Spacing.xs,
  },
  notedSubtitle: {
    marginBottom: Spacing.sm,
  },
  notedActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  notedAddBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
  },
  notedDismissBtn: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderColor: Colors.border,
    borderWidth: 1,
  },
});
