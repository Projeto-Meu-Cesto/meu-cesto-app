import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../scripts/firebaseConfig';
import { Colors, Spacing, Radius, STATUS_BAR_HEIGHT } from '../constants/theme';
import { Typography } from '../components/ui/Typography';
import { getCachedPurchases, mergePurchaseRecords, type PurchaseRecord } from '../scripts/financeContext';
import { getItemTotal, toDate, toMonthKey } from '../scripts/utils';

type ShoppingListItem = {
  id: string;
  name?: string;
  price?: string | number;
  quantity?: string | number;
  checked?: boolean;
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

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  
  const [listSummary, setListSummary] = useState({
    total: 0,
    checked: 0,
    pending: 0,
    estimated: 0,
    spent: 0,
  });

  useEffect(() => {
    if (!user) return;
    const loadSummary = async () => {
      try {
        const shoppingQuery = query(collection(db, 'users', user.uid, 'shopping_list'), orderBy('createdAt', 'desc'));
        const purchasesQuery = query(collection(db, 'users', user.uid, 'purchases'), orderBy('finalizedAt', 'desc'), limit(120));

        const [listSnap, purchasesSnap, cachedPurchases] = await Promise.all([
          getDocs(shoppingQuery),
          getDocs(purchasesQuery),
          getCachedPurchases(user.uid),
        ]);

        const shoppingItems = listSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ShoppingListItem[];
        const firestorePurchases = purchasesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PurchaseRecord[];
        const purchases = mergePurchaseRecords(firestorePurchases, cachedPurchases);

        const currentMonthKey = toMonthKey(new Date());
        const checkedItems = shoppingItems.filter(item => item.checked);
        const purchasedSourceIds = new Set<string>();
        let spent = 0;

        purchases.forEach((purchase) => {
          const purchaseDate = toDate(purchase.finalizedAt) || toDate(purchase.createdAt) || new Date();
          if (toMonthKey(purchaseDate) !== currentMonthKey) return;
          (purchase.items || []).forEach((item) => {
            const amount = typeof item.total === 'number' && Number.isFinite(item.total) ? item.total : (Number(item.price) || 0) * (Number(item.quantity) || 1);
            if (amount <= 0) return;
            if (item.sourceItemId) purchasedSourceIds.add(item.sourceItemId);
            spent += amount;
          });
        });

        checkedItems.forEach((item) => {
          if (purchasedSourceIds.has(item.id)) return;
          const amount = getItemTotal(item);
          if (amount <= 0) return;
          spent += amount;
        });

        const estimated = shoppingItems.reduce((acc, item) => acc + getItemTotal(item), 0);

        setListSummary({
          total: shoppingItems.length,
          checked: checkedItems.length,
          pending: shoppingItems.length - checkedItems.length,
          estimated,
          spent,
        });
      } catch (e) {
        console.warn('Erro ao carregar notificações', e);
      }
    };
    loadSummary();
  }, [user]);

  const notifications = useMemo<HomeNotification[]>(() => {
    const totalSpent = listSummary.spent;
    return [
      {
        id: 'month-total',
        icon: 'wallet-outline',
        title: 'Gastos confirmados',
        description: totalSpent > 0
          ? `Você marcou ${formatCurrency(totalSpent)} como comprado.`
          : 'Nenhum item foi marcado como comprado ainda.',
        color: Colors.primary,
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
        color: listSummary.pending > 0 ? Colors.warning : Colors.primary,
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
        action: () => router.push('/luca'),
      },
    ];
  }, [listSummary, router]);

  const handleNotificationAction = (notification: HomeNotification) => {
    if (notification.action) {
      router.back();
      setTimeout(() => notification.action?.(), 100);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Typography variant="title" weight="bold" color={Colors.textPrimary}>
          Notificações
        </Typography>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationList}>
        {notifications.map(notification => (
          <View key={notification.id} style={styles.notificationItem}>
            <View style={[styles.notificationIcon, { backgroundColor: 'rgba(23, 27, 23, 0.6)' }]}>
              <Ionicons name={notification.icon} size={20} color={notification.color} />
            </View>
            <View style={styles.notificationBody}>
              <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                {notification.title}
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary} style={styles.notificationDescription}>
                {notification.description}
              </Typography>
              {notification.actionLabel && (
                <TouchableOpacity
                  style={styles.notificationAction}
                  onPress={() => handleNotificationAction(notification)}
                >
                  <Typography variant="caption" weight="bold" color={Colors.primary}>
                    {notification.actionLabel}
                  </Typography>
                  <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: STATUS_BAR_HEIGHT + Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notificationList: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  notificationBody: {
    flex: 1,
    justifyContent: 'center',
  },
  notificationDescription: {
    marginTop: 4,
    lineHeight: 18,
  },
  notificationAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 4,
  },
});
