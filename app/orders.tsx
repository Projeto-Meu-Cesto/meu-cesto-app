import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Card } from '../components/ui/Card';
import { Typography } from '../components/ui/Typography';
import { Colors, Radius, Spacing, STATUS_BAR_HEIGHT } from '../constants/theme';
import { ORDER_STATUS_META } from '../domain/orderPresentation';
import type { Order } from '../domain/orders';
import { auth } from '../scripts/firebaseConfig';
import { formatCurrency } from '../scripts/utils';
import { createUserCommerceRepository } from '../services/userCommerceRepository';

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
    return createUserCommerceRepository(user.uid).subscribeOrders(
      (result) => { setOrders(result); setLoading(false); },
      (subscriptionError) => { console.error(subscriptionError); setError(true); setLoading(false); },
    );
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Typography variant="heading">Meus pedidos</Typography>
          <Typography variant="caption" color={Colors.textSecondary}>Histórico demonstrativo</Typography>
        </View>
        <Pressable accessibilityLabel="Nova compra" onPress={() => router.push('/catalog')} style={styles.headerButton}>
          <Ionicons name="add" size={26} color={Colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.state}><ActivityIndicator color={Colors.primary} /><Typography color={Colors.textSecondary}>Carregando pedidos...</Typography></View>
      ) : error ? (
        <View style={styles.state}><Ionicons name="cloud-offline-outline" size={40} color={Colors.error} /><Typography variant="title" weight="semibold">Pedidos indisponíveis</Typography><Typography color={Colors.textSecondary} align="center">Confira sua conexão e tente novamente.</Typography></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.content, orders.length === 0 && styles.emptyContent]}
          ListEmptyComponent={(
            <View style={styles.state}>
              <Ionicons name="receipt-outline" size={44} color={Colors.primary} />
              <Typography variant="title" weight="semibold">Nenhum pedido ainda</Typography>
              <Typography color={Colors.textSecondary} align="center">Monte uma compra para demonstrar o fluxo completo.</Typography>
              <Pressable onPress={() => router.push('/catalog')} style={styles.emptyAction}><Typography weight="semibold" color={Colors.background}>Abrir catálogo</Typography></Pressable>
            </View>
          )}
          renderItem={({ item }) => {
            const meta = ORDER_STATUS_META[item.status];
            return (
              <Pressable onPress={() => router.push(`/order/${item.id}` as never)}>
                <Card style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <View>
                      <Typography variant="caption" color={Colors.textMuted}>PEDIDO #{item.id.slice(-6).toUpperCase()}</Typography>
                      <Typography variant="title" weight="semibold">{formatCurrency(item.totals.total)}</Typography>
                    </View>
                    <View style={[styles.status, { backgroundColor: `${meta.color}18` }]}>
                      <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                      <Typography variant="caption" weight="semibold" color={meta.color}>{meta.label}</Typography>
                    </View>
                  </View>
                  <View style={styles.orderBottom}>
                    <Typography variant="caption" color={Colors.textSecondary}>{item.items.length} produtos · {item.fulfillment.mode === 'pickup' ? 'Retirada' : 'Entrega'}</Typography>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: STATUS_BAR_HEIGHT + Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: Spacing.sm },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: Spacing.lg, gap: Spacing.md },
  emptyContent: { flexGrow: 1 },
  orderCard: { gap: Spacing.md },
  orderTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  statusDot: { width: 7, height: 7, borderRadius: Radius.full },
  orderBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  state: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  emptyAction: { marginTop: Spacing.md, minHeight: 48, justifyContent: 'center', paddingHorizontal: Spacing.xl, borderRadius: Radius.full, backgroundColor: Colors.primary },
});
