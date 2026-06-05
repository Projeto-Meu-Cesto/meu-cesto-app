import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PullToRefreshScroll } from '../../components/PullToRefreshScroll';
import { BG_LIGHT, PRIMARY_GREEN, STATUS_BAR_HEIGHT, TEXT_DARK, TEXT_GRAY, WARNING } from '../../constants/theme';
import { getCachedPurchases, mergePurchaseRecords, type PurchaseRecord } from '../../scripts/financeContext';
import { auth, db } from '../../scripts/firebaseConfig';
import { getItemTotal, getQuantity, parseMoney, toDate, toMonthKey, wait } from '../../scripts/utils';

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

type Greeting = {
  morning: string,
  afternoon: string,
  evening: string,
}

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
      style={[
        { width: w, height: h, backgroundColor: '#E2E8F0', borderRadius: 10, opacity },
        style,
      ]}
    />
  );
}

function SkeletonListItem() {
  return (
    <View style={skStyles.row}>
      <SkeletonBox width={12} height={12} style={{ borderRadius: 6, marginRight: 14 }} />
      <SkeletonBox width="55%" height={14} />
      <SkeletonBox width={50} height={14} style={{ marginLeft: 'auto' }} />
    </View>
  );
}

function SkeletonMainCard() {
  return (
    <View style={styles.mainCard}>
      <SkeletonBox width={130} height={13} style={skStyles.onGreen} />
      <SkeletonBox width={200} height={36} style={[skStyles.onGreen, { marginTop: 10 }]} />
      <SkeletonBox width={220} height={12} style={[skStyles.onGreen, { marginTop: 10 }]} />
    </View>
  );
}

function SkeletonQuickCard() {
  return (
    <View style={styles.catCard}>
      <SkeletonBox width={40} height={40} style={{ borderRadius: 12, marginBottom: 8 }} />
      <SkeletonBox width={56} height={10} style={{ marginBottom: 6 }} />
      <SkeletonBox width={48} height={14} />
    </View>
  );
}

const skStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  onGreen: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
});

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [weeklyList, setWeeklyList] = useState<ShoppingListItem[]>([]);
  const [listSummary, setListSummary] = useState<ListSummary>({
    total: 0,
    checked: 0,
    pending: 0,
    estimated: 0,
    spent: 0,
    confirmed: 0,
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsSeen, setNotificationsSeen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const showSkeleton = loading || isRefreshing;

  const refreshHomeData = React.useCallback(async () => {
    if (!user) return;

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

    const purchases = mergePurchaseRecords(firestorePurchases, cachedPurchases);
    setWeeklyList(shoppingItems.slice(0, 4));
    setListSummary(buildListSummary(shoppingItems, purchases));
    setDataVersion((v) => v + 1);
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

      const purchases = mergePurchaseRecords(firestorePurchases, cachedPurchases);
      setWeeklyList(shoppingItems.slice(0, 4));
      setListSummary(buildListSummary(shoppingItems, purchases));
      setLoading(false);
    };

    getCachedPurchases(user.uid)
      .then((purchases) => {
        cachedPurchases = purchases;
        if (purchases.length > 0) {
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

  const notifications = useMemo<HomeNotification[]>(() => {
    const totalSpent = listSummary.spent;
    const messages: HomeNotification[] = [
      {
        id: 'month-total',
        icon: 'wallet-outline',
        title: 'Gastos confirmados',
        description: totalSpent > 0
          ? `Você marcou ${formatCurrency(totalSpent)} como comprado.`
          : 'Nenhum item foi marcado como comprado ainda.',
        color: PRIMARY_GREEN,
        actionLabel: 'Ver finanças',
        action: () => router.push('/stats'),
      },
      {
        id: 'shopping-list',
        icon: listSummary.pending > 0 ? 'cart-outline' : 'checkmark-circle-outline',
        title: listSummary.pending > 0 ? 'Itens pendentes' : 'Lista em dia',
        description: listSummary.total > 0
          ? `${listSummary.pending} pendente(s), ${listSummary.checked} no carrinho. Estimativa: ${formatCurrency(listSummary.estimated)}.`
          : 'Sua lista ainda está vazia. Adicione itens para acompanhar melhor seus gastos.',
        color: listSummary.pending > 0 ? WARNING : PRIMARY_GREEN,
        actionLabel: listSummary.total > 0 ? 'Abrir lista' : 'Adicionar item',
        action: () => router.push(listSummary.total > 0 ? '/lists' : '/addItem'),
      },
      {
        id: 'luca',
        icon: 'sparkles-outline',
        title: 'Luca pronto para ajudar',
        description: 'Peça dicas de economia com base nos seus itens e gastos reais.',
        color: '#38BDF8',
        actionLabel: 'Falar com Luca',
        action: () => router.push('/luca-tab' as any),
      },
    ];

    if (listSummary.pending >= 5) {
      messages.unshift({
        id: 'many-pending',
        icon: 'alert-circle-outline',
        title: 'Lista ficando grande',
        description: `Você tem ${listSummary.pending} itens pendentes. Vale revisar antes de ir ao mercado.`,
        color: '#EF4444',
        actionLabel: 'Revisar agora',
        action: () => router.push('/lists'),
      });
    }

    return messages;
  }, [listSummary, router]);

  const quickCards = useMemo(() => [
    { id: 'pending', label: 'Pendentes', value: String(listSummary.pending), icon: 'cart-outline' },
    { id: 'checked', label: 'No carrinho', value: String(listSummary.checked), icon: 'checkmark-circle-outline' },
    { id: 'estimated', label: 'Estimado', value: formatCurrency(listSummary.estimated), icon: 'calculator-outline' },
  ], [listSummary]);

  const openNotifications = () => {
    setNotificationsOpen(true);
    setNotificationsSeen(true);
  };

  const closeNotifications = () => {
    setNotificationsOpen(false);
  };

  const handleNotificationAction = (notification: HomeNotification) => {
    setNotificationsOpen(false);
    notification.action?.();
  };

  const greeting = (greeting: Greeting) => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return greeting.morning;
    }
    if (hour < 18) {
      return greeting.afternoon;
    }
    return greeting.evening;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_GREEN} translucent />

      <PullToRefreshScroll
        lockScrollDown
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { minHeight: windowHeight }]}
        refreshOffset={STATUS_BAR_HEIGHT + 8}
        backgroundColor={PRIMARY_GREEN}
        onRefreshingChange={setIsRefreshing}
        onRefresh={refreshHomeData}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>{greeting({ morning: 'Bom dia', afternoon: 'Boa tarde', evening: 'Boa noite' })},</Text>
              <Text style={styles.userName}>{user?.displayName || 'Usuário'}</Text>
            </View>
            <TouchableOpacity
              style={styles.notificationCircle}
              onPress={openNotifications}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Abrir notificações"
            >
              <Ionicons name="notifications" size={20} color="#fff" />
              {!notificationsSeen && <View style={styles.activeDot} />}
            </TouchableOpacity>
          </View>

          {showSkeleton ? (
            <SkeletonMainCard />
          ) : (
            <View style={styles.mainCard}>
              <Text style={styles.mainCardLabel}>Gasto confirmado</Text>
              <Text style={styles.mainCardAmount}>{formatCurrency(listSummary.spent)}</Text>
              <Text style={styles.mainCardSubtitle}>
                {listSummary.confirmed} item(ns) confirmados neste mês
              </Text>
            </View>
          )}
        </View>

        <View style={styles.mainContent}>
          {/* Categories */}
          <View style={styles.categoriesRow}>
            {showSkeleton ? (
              <>
                <SkeletonQuickCard />
                <SkeletonQuickCard />
                <SkeletonQuickCard />
              </>
            ) : (
              quickCards.map((cat) => (
                <CategoryCard key={cat.id} icon={cat.icon} label={cat.label} value={cat.value} />
              ))
            )}
          </View>

          {/* Weekly List */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>LISTA DA SEMANA</Text>
            <TouchableOpacity onPress={() => router.push('/lists')}>
              <Text style={styles.seeAll}>Ver tudo →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listContainer}>
            {showSkeleton ? (
              <>
                <SkeletonListItem />
                <SkeletonListItem />
                <SkeletonListItem />
              </>
            ) : weeklyList.length > 0 ? (
              weeklyList.map((item: any) => (
                <ListItem
                  key={item.id}
                  name={item.name}
                  price={item.price}
                  quantity={item.quantity}
                  color={item.color || '#CBD5E1'}
                />
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="cart-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyText}>Nenhum item adicionado à lista.</Text>
              </View>
            )}
          </View>

          {/* Falar com Luca */}
          <TouchableOpacity style={styles.lucaBtn} onPress={() => router.push('/luca-tab' as any)}>
            <View style={styles.lucaBtnLeft}>
              <View style={styles.lucaIconBg}>
                <Ionicons name="sparkles" size={20} color={PRIMARY_GREEN} />
              </View>
              <View>
                <Text style={styles.lucaBtnTitle}>Falar com Luca</Text>
                <Text style={styles.lucaBtnSub}>Insights e dicas com IA</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={PRIMARY_GREEN} />
          </TouchableOpacity>
        </View>
      </PullToRefreshScroll>

      <Modal visible={notificationsOpen} transparent animationType="fade" onRequestClose={closeNotifications}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeNotifications} />
          <View style={styles.notificationPanel}>
            <View style={styles.notificationHeader}>
              <View>
                <Text style={styles.notificationTitle}>Notificações</Text>
                <Text style={styles.notificationSubtitle}>Resumo rápido do seu cesto</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={closeNotifications}>
                <Ionicons name="close" size={22} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationList}>
              {notifications.map(notification => (
                <View key={notification.id} style={styles.notificationItem}>
                  <View style={[styles.notificationIcon, { backgroundColor: `${notification.color}18` }]}>
                    <Ionicons name={notification.icon} size={20} color={notification.color} />
                  </View>
                  <View style={styles.notificationBody}>
                    <Text style={styles.notificationItemTitle}>{notification.title}</Text>
                    <Text style={styles.notificationDescription}>{notification.description}</Text>
                    {notification.actionLabel && (
                      <TouchableOpacity
                        style={styles.notificationAction}
                        onPress={() => handleNotificationAction(notification)}
                      >
                        <Text style={styles.notificationActionText}>{notification.actionLabel}</Text>
                        <Ionicons name="chevron-forward" size={16} color={PRIMARY_GREEN} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CategoryCard({ icon, label, value }: any) {
  return (
    <View style={styles.catCard}>
      <View style={styles.catIconWrapper}>
        <Ionicons name={icon} size={22} color={TEXT_GRAY} />
      </View>
      <Text style={styles.catLabel}>{label}</Text>
      <Text style={styles.catValue}>{value}</Text>
    </View>
  );
}

function ListItem({
  name,
  price,
  quantity,
  color = '#CBD5E1',
}: Pick<ShoppingListItem, 'name' | 'price' | 'quantity' | 'color'>) {
  const amount = getItemTotal({ price, quantity });
  const quantityValue = getQuantity(quantity);

  return (
    <View style={styles.listItem}>
      <View style={styles.listItemLeft}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <View style={styles.listItemText}>
          <Text style={styles.itemName}>{name || 'Item'}</Text>
          {quantityValue > 1 ? (
            <Text style={styles.itemMeta}>{quantityValue} un.</Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.itemPrice}>{amount > 0 ? formatCurrency(amount) : '--'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY_GREEN,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingHorizontal: 20,
    paddingTop: STATUS_BAR_HEIGHT + 10,
    paddingBottom: 35,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  notificationCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    backgroundColor: '#FF5252',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: PRIMARY_GREEN,
  },
  mainCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  mainCardLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  mainCardAmount: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 5,
  },
  mainCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 25,
    paddingBottom: 100,
    backgroundColor: BG_LIGHT,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    minHeight: 600,
  },
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  catCard: {
    width: (width - 60) / 3,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  catIconWrapper: {
    marginBottom: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catLabel: {
    fontSize: 10,
    color: TEXT_GRAY,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  catValue: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_GREEN,
  },
  listContainer: {
    gap: 10,
    marginBottom: 25,
  },
  listItem: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  listItemText: {
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  itemMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_GRAY,
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F1F5F9',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: STATUS_BAR_HEIGHT + 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  notificationPanel: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  notificationTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  notificationSubtitle: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BG_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationList: {
    gap: 12,
    paddingBottom: 2,
  },
  notificationItem: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: BG_LIGHT,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  notificationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBody: {
    flex: 1,
  },
  notificationItemTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  notificationDescription: {
    fontSize: 12,
    color: TEXT_GRAY,
    lineHeight: 17,
    fontWeight: '600',
    marginTop: 4,
  },
  notificationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 10,
    gap: 2,
  },
  notificationActionText: {
    fontSize: 12,
    color: PRIMARY_GREEN,
    fontWeight: '900',
  },
});
