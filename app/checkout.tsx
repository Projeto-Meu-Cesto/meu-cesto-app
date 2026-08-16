import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppModal } from '../components/ui/AppModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Typography } from '../components/ui/Typography';
import { Colors, Radius, Spacing, STATUS_BAR_HEIGHT } from '../constants/theme';
import { useCart } from '../context/CartContext';
import type { DemoPaymentScenario } from '../domain/payment';
import { auth } from '../scripts/firebaseConfig';
import { formatCurrency } from '../scripts/utils';
import { createUserOrderWorkflow } from '../services/userOrderWorkflow';

type FulfillmentMode = 'pickup' | 'delivery';

const pickupSlots = ['Hoje, 18h–19h', 'Amanhã, 9h–10h', 'Amanhã, 17h–18h'];

export default function CheckoutScreen() {
  const router = useRouter();
  const { state, subtotal, clearCart } = useCart();
  const [mode, setMode] = useState<FulfillmentMode>('pickup');
  const [pickupSlot, setPickupSlot] = useState(pickupSlots[0]);
  const [address, setAddress] = useState('');
  const [scenario, setScenario] = useState<DemoPaymentScenario>('approved');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deliveryFee = mode === 'delivery' ? 7.5 : 0;
  const total = subtotal + deliveryFee;

  const service = useMemo(() => {
    const user = auth.currentUser;
    return user ? createUserOrderWorkflow(user.uid).orders : null;
  }, []);

  const submit = async () => {
    const user = auth.currentUser;
    if (!user || !service) {
      setError('Entre novamente para concluir o pedido.');
      return;
    }
    if (state.items.length === 0) {
      setError('Seu carrinho está vazio.');
      return;
    }
    if (mode === 'delivery' && !address.trim()) {
      setError('Informe o endereço para a entrega demonstrativa.');
      return;
    }

    setProcessing(true);
    try {
      const order = await service.create({
        uid: user.uid,
        marketId: state.marketId,
        items: state.items.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          category: product.category,
          unitPrice: product.price,
          quantity,
        })),
        fulfillment: mode === 'pickup'
          ? { mode: 'pickup', pickupSlot }
          : { mode: 'delivery', address: address.trim(), deliveryWindow: 'Até 90 minutos' },
        paymentScenario: scenario,
        deliveryFee,
      });

      if (order.status === 'confirmado') clearCart();
      router.replace(`/order/${order.id}` as never);
    } catch (submitError) {
      console.error(submitError);
      setError('Não foi possível salvar o pedido demonstrativo. Tente novamente.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Typography variant="heading">Finalizar pedido</Typography>
          <Typography variant="caption" color={Colors.textSecondary}>Checkout demonstrativo</Typography>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.demoNotice}>
          <Ionicons name="flask-outline" size={22} color={Colors.warning} />
          <View style={styles.noticeCopy}>
            <Typography variant="caption" weight="semibold" color={Colors.warning}>NENHUMA COBRANÇA SERÁ FEITA</Typography>
            <Typography variant="caption" color={Colors.textSecondary}>Você está validando o fluxo de compra em um ambiente de demonstração.</Typography>
          </View>
        </View>

        <Typography variant="title" weight="semibold" style={styles.sectionTitle}>Como você quer receber?</Typography>
        <View style={styles.optionGrid}>
          {([
            { value: 'pickup' as const, label: 'Retirar no mercado', icon: 'storefront-outline' as const, detail: 'Sem taxa' },
            { value: 'delivery' as const, label: 'Receber em casa', icon: 'bicycle-outline' as const, detail: formatCurrency(7.5) },
          ]).map((option) => {
            const selected = mode === option.value;
            return (
              <Pressable key={option.value} onPress={() => setMode(option.value)} style={[styles.optionCard, selected && styles.optionSelected]}>
                <Ionicons name={option.icon} size={26} color={selected ? Colors.primary : Colors.textSecondary} />
                <Typography weight="semibold">{option.label}</Typography>
                <Typography variant="caption" color={Colors.textSecondary}>{option.detail}</Typography>
              </Pressable>
            );
          })}
        </View>

        {mode === 'pickup' ? (
          <View style={styles.fieldGroup}>
            <Typography variant="title" weight="semibold">Horário de retirada</Typography>
            <View style={styles.slotList}>
              {pickupSlots.map((slot) => (
                <Pressable key={slot} onPress={() => setPickupSlot(slot)} style={[styles.slot, pickupSlot === slot && styles.slotSelected]}>
                  <Ionicons name={pickupSlot === slot ? 'radio-button-on' : 'radio-button-off'} size={20} color={pickupSlot === slot ? Colors.primary : Colors.textMuted} />
                  <Typography weight="medium">{slot}</Typography>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.fieldGroup}>
            <Typography variant="title" weight="semibold">Endereço de entrega</Typography>
            <TextInput
              accessibilityLabel="Endereço de entrega"
              value={address}
              onChangeText={setAddress}
              placeholder="Rua, número, complemento e bairro"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Typography variant="caption" color={Colors.textSecondary}>Prazo demonstrativo: até 90 minutos.</Typography>
          </View>
        )}

        <View style={styles.fieldGroup}>
          <Typography variant="title" weight="semibold">Resultado do pagamento</Typography>
          <Typography variant="caption" color={Colors.textSecondary}>Escolha um cenário para demonstrar o comportamento do app.</Typography>
          <View style={styles.optionGrid}>
            <Pressable onPress={() => setScenario('approved')} style={[styles.paymentOption, scenario === 'approved' && styles.optionSelected]}>
              <Ionicons name="checkmark-circle-outline" size={24} color={Colors.primary} />
              <Typography weight="semibold">Simular aprovação</Typography>
            </Pressable>
            <Pressable onPress={() => setScenario('declined')} style={[styles.paymentOption, scenario === 'declined' && styles.declinedSelected]}>
              <Ionicons name="close-circle-outline" size={24} color={Colors.error} />
              <Typography weight="semibold">Simular recusa</Typography>
            </Pressable>
          </View>
        </View>

        <Card elevated style={styles.summary}>
          <View style={styles.summaryRow}><Typography color={Colors.textSecondary}>Produtos</Typography><Typography>{formatCurrency(subtotal)}</Typography></View>
          <View style={styles.summaryRow}><Typography color={Colors.textSecondary}>Taxa</Typography><Typography>{formatCurrency(deliveryFee)}</Typography></View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}><Typography variant="title" weight="semibold">Total</Typography><Typography variant="title" weight="bold" color={Colors.primary}>{formatCurrency(total)}</Typography></View>
        </Card>

        <Button label="Processar pedido demonstrativo" loading={processing} onPress={submit} size="lg" />
      </ScrollView>

      <AppModal
        visible={error !== null}
        onClose={() => setError(null)}
        title="Não foi possível continuar"
        description={error ?? ''}
        type="warning"
        cancelLabel="Entendi"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: STATUS_BAR_HEIGHT + Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: Spacing.sm },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: Spacing.lg, paddingBottom: Spacing.xxxl, gap: Spacing.lg },
  demoNotice: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: 'rgba(255, 200, 87, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 200, 87, 0.24)' },
  noticeCopy: { flex: 1, gap: 2 },
  sectionTitle: { marginTop: Spacing.sm },
  optionGrid: { flexDirection: 'row', gap: Spacing.md },
  optionCard: { flex: 1, minHeight: 120, padding: Spacing.lg, gap: Spacing.sm, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  optionSelected: { borderColor: Colors.primary, backgroundColor: 'rgba(183, 255, 0, 0.07)' },
  declinedSelected: { borderColor: Colors.error, backgroundColor: 'rgba(255, 92, 92, 0.07)' },
  fieldGroup: { gap: Spacing.md },
  slotList: { gap: Spacing.sm },
  slot: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  slotSelected: { borderColor: Colors.primary },
  input: { minHeight: 52, paddingHorizontal: Spacing.lg, color: Colors.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 16, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg },
  paymentOption: { flex: 1, minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  summary: { gap: Spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.border },
});
