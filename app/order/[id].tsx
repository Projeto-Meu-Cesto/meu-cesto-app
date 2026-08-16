import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppModal } from '../../components/ui/AppModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { Colors, Radius, Spacing, STATUS_BAR_HEIGHT } from '../../constants/theme';
import { ORDER_STATUS_META } from '../../domain/orderPresentation';
import type { Order, OrderStatus } from '../../domain/orders';
import { auth } from '../../scripts/firebaseConfig';
import { formatCurrency } from '../../scripts/utils';
import { createUserCommerceRepository, type OrderEvent } from '../../services/userCommerceRepository';
import { createUserOrderWorkflow } from '../../services/userOrderWorkflow';

function nextDemoStatus(order: Order): { status: OrderStatus; label: string } | null {
  switch (order.status) {
    case 'confirmado': return { status: 'em_preparo', label: 'Iniciar preparo' };
    case 'em_preparo': return order.fulfillment.mode === 'pickup'
      ? { status: 'pronto_retirada', label: 'Marcar pronto para retirada' }
      : { status: 'em_entrega', label: 'Enviar para entrega' };
    case 'pronto_retirada':
    case 'em_entrega': return { status: 'concluido', label: 'Concluir pedido' };
    case 'concluido': return { status: 'estornado', label: 'Simular estorno' };
    default: return null;
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default function OrderDetailScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repository = useMemo(() => {
    const user = auth.currentUser;
    return user ? createUserCommerceRepository(user.uid) : null;
  }, []);
  const service = useMemo(() => {
    const user = auth.currentUser;
    return user ? createUserOrderWorkflow(user.uid).orders : null;
  }, []);

  useEffect(() => {
    if (!repository || !orderId) {
      setLoading(false);
      return;
    }
    const unsubscribeOrder = repository.subscribeOrder(orderId, (result) => {
      setOrder(result);
      setLoading(false);
    }, (subscriptionError) => {
      console.error(subscriptionError);
      setError('Não foi possível acompanhar este pedido.');
      setLoading(false);
    });
    const unsubscribeEvents = repository.subscribeOrderEvents(orderId, setEvents, console.error);
    return () => { unsubscribeOrder(); unsubscribeEvents(); };
  }, [orderId, repository]);

  const transition = async (nextStatus: OrderStatus) => {
    if (!service || !order) return;
    setTransitioning(true);
    try {
      await service.transition(order.id, nextStatus);
    } catch (transitionError) {
      console.error(transitionError);
      setError('Essa mudança de status não é permitida. Atualize o pedido e tente novamente.');
    } finally {
      setTransitioning(false);
      setCancelVisible(false);
    }
  };

  if (loading) {
    return <View style={styles.fullState}><ActivityIndicator color={Colors.primary} /><Typography color={Colors.textSecondary}>Carregando pedido...</Typography></View>;
  }

  if (!order) {
    return <View style={styles.fullState}><Ionicons name="receipt-outline" size={44} color={Colors.textMuted} /><Typography variant="title" weight="semibold">Pedido não encontrado</Typography><Button label="Voltar aos pedidos" onPress={() => router.replace('/orders')} /></View>;
  }

  const meta = ORDER_STATUS_META[order.status];
  const next = nextDemoStatus(order);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Typography variant="heading">Pedido #{order.id.slice(-6).toUpperCase()}</Typography>
          <Typography variant="caption" color={Colors.textSecondary}>Operação demonstrativa</Typography>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card elevated style={styles.statusCard}>
          <View style={[styles.statusIcon, { backgroundColor: `${meta.color}18` }]}>
            <Ionicons name={order.status === 'recusado' || order.status === 'cancelado' ? 'close' : 'checkmark'} size={28} color={meta.color} />
          </View>
          <View style={styles.statusCopy}>
            <Typography variant="title" weight="semibold" color={meta.color}>{meta.label}</Typography>
            <Typography color={Colors.textSecondary}>{meta.description}</Typography>
          </View>
        </Card>

        <Typography variant="title" weight="semibold">Acompanhamento</Typography>
        <Card style={styles.timeline}>
          {events.map((event, index) => {
            const eventMeta = ORDER_STATUS_META[event.status];
            return (
              <View key={event.id} style={styles.timelineRow}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, { backgroundColor: eventMeta.color }]} />
                  {index < events.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineCopy}>
                  <Typography weight="semibold">{eventMeta.label}</Typography>
                  <Typography variant="caption" color={Colors.textSecondary}>{formatDate(event.createdAt)}</Typography>
                </View>
              </View>
            );
          })}
        </Card>

        <Typography variant="title" weight="semibold">Produtos</Typography>
        <Card style={styles.itemsCard}>
          {order.items.map((item) => (
            <View key={item.productId} style={styles.itemRow}>
              <View style={styles.itemQuantity}><Typography variant="caption" weight="bold" color={Colors.background}>{item.quantity}×</Typography></View>
              <View style={styles.itemCopy}><Typography weight="medium">{item.name}</Typography><Typography variant="caption" color={Colors.textSecondary}>{formatCurrency(item.unitPrice)} cada</Typography></View>
              <Typography weight="semibold">{formatCurrency(item.unitPrice * item.quantity)}</Typography>
            </View>
          ))}
        </Card>

        <Typography variant="title" weight="semibold">Entrega e pagamento</Typography>
        <Card style={styles.detailCard}>
          <View style={styles.detailRow}><Ionicons name={order.fulfillment.mode === 'pickup' ? 'storefront-outline' : 'bicycle-outline'} size={22} color={Colors.primary} /><View style={styles.detailCopy}><Typography weight="semibold">{order.fulfillment.mode === 'pickup' ? 'Retirada no mercado' : 'Entrega em casa'}</Typography><Typography variant="caption" color={Colors.textSecondary}>{order.fulfillment.mode === 'pickup' ? order.fulfillment.pickupSlot : order.fulfillment.address}</Typography></View></View>
          <View style={styles.divider} />
          <View style={styles.detailRow}><Ionicons name="card-outline" size={22} color={Colors.primary} /><View style={styles.detailCopy}><Typography weight="semibold">Pagamento demonstrativo</Typography><Typography variant="caption" color={Colors.textSecondary}>{order.payment.status === 'approved' ? 'Aprovado no simulador' : 'Recusado no simulador'}</Typography></View></View>
        </Card>

        <Card elevated style={styles.totalCard}>
          <View style={styles.totalRow}><Typography color={Colors.textSecondary}>Subtotal</Typography><Typography>{formatCurrency(order.totals.subtotal)}</Typography></View>
          <View style={styles.totalRow}><Typography color={Colors.textSecondary}>Taxa</Typography><Typography>{formatCurrency(order.totals.deliveryFee)}</Typography></View>
          <View style={styles.divider} />
          <View style={styles.totalRow}><Typography variant="title" weight="semibold">Total</Typography><Typography variant="title" weight="bold" color={Colors.primary}>{formatCurrency(order.totals.total)}</Typography></View>
        </Card>

        {next && (
          <Button label={next.label} loading={transitioning} onPress={() => transition(next.status)} size="lg" variant={next.status === 'estornado' ? 'danger' : 'primary'} />
        )}
        {order.status === 'confirmado' && (
          <Button label="Cancelar pedido" variant="outline" disabled={transitioning} onPress={() => setCancelVisible(true)} />
        )}
        {order.status === 'recusado' && <Button label="Montar outro pedido" onPress={() => router.replace('/catalog')} />}
      </ScrollView>

      <AppModal
        visible={cancelVisible}
        onClose={() => setCancelVisible(false)}
        title="Cancelar pedido"
        description="O pedido demonstrativo será encerrado e não poderá avançar para preparo."
        type="error"
        destructive
        confirmLabel="Cancelar pedido"
        cancelLabel="Manter pedido"
        loading={transitioning}
        onConfirm={() => transition('cancelado')}
      />
      <AppModal visible={error !== null} onClose={() => setError(null)} title="Pedido não atualizado" description={error ?? ''} type="warning" cancelLabel="Entendi" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  fullState: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  header: { paddingTop: STATUS_BAR_HEIGHT + Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: Spacing.sm },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  statusIcon: { width: 56, height: 56, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  statusCopy: { flex: 1, gap: 2 },
  timeline: { gap: 0 },
  timelineRow: { minHeight: 64, flexDirection: 'row', gap: Spacing.md },
  timelineRail: { width: 16, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: Radius.full, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: Colors.border },
  timelineCopy: { flex: 1, gap: 2 },
  itemsCard: { gap: Spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  itemQuantity: { width: 32, height: 32, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  itemCopy: { flex: 1 },
  detailCard: { gap: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  detailCopy: { flex: 1 },
  divider: { height: 1, backgroundColor: Colors.border },
  totalCard: { gap: Spacing.md },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
});
