import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppModal } from '../components/ui/AppModal';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Typography } from '../components/ui/Typography';
import { Colors, Radius, Spacing, STATUS_BAR_HEIGHT } from '../constants/theme';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../scripts/utils';

export default function CartScreen() {
  const router = useRouter();
  const { state, itemCount, subtotal, setQuantity, removeProduct } = useCart();
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const target = state.items.find((item) => item.product.id === removeTarget);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Typography variant="heading">Seu carrinho</Typography>
          <Typography variant="caption" color={Colors.textSecondary}>{itemCount} {itemCount === 1 ? 'item' : 'itens'}</Typography>
        </View>
      </View>

      {state.items.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><Ionicons name="bag-handle-outline" size={42} color={Colors.primary} /></View>
          <Typography variant="title" weight="semibold">Seu carrinho está vazio</Typography>
          <Typography color={Colors.textSecondary} align="center">Escolha produtos no catálogo demonstrativo para montar o pedido.</Typography>
          <Button label="Ver catálogo" onPress={() => router.replace('/catalog')} style={styles.emptyButton} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.demoNotice}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.warning} />
              <Typography variant="caption" color={Colors.textSecondary} style={styles.noticeText}>
                Este carrinho usa produtos, preços e estoque de demonstração.
              </Typography>
            </View>

            <View style={styles.items}>
              {state.items.map(({ product, quantity }) => (
                <Card key={product.id} style={styles.itemCard}>
                  <View style={styles.productIcon}>
                    <Ionicons name="basket-outline" size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.itemCopy}>
                    <Typography variant="body" weight="semibold" numberOfLines={2}>{product.name}</Typography>
                    <Typography variant="caption" color={Colors.textSecondary}>{formatCurrency(product.price)} · {product.unit}</Typography>
                    <View style={styles.quantityRow}>
                      <Pressable accessibilityLabel={`Diminuir ${product.name}`} onPress={() => setQuantity(product.id, quantity - 1)} style={styles.quantityButton}>
                        <Ionicons name="remove" size={18} color={Colors.textPrimary} />
                      </Pressable>
                      <Typography weight="semibold" align="center" style={styles.quantityValue}>{quantity}</Typography>
                      <Pressable accessibilityLabel={`Aumentar ${product.name}`} disabled={quantity >= product.stockQuantity} onPress={() => setQuantity(product.id, quantity + 1)} style={[styles.quantityButton, quantity >= product.stockQuantity && styles.disabled]}>
                        <Ionicons name="add" size={18} color={Colors.textPrimary} />
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.itemAside}>
                    <Pressable accessibilityLabel={`Remover ${product.name}`} onPress={() => setRemoveTarget(product.id)} style={styles.removeButton}>
                      <Ionicons name="trash-outline" size={19} color={Colors.error} />
                    </Pressable>
                    <Typography variant="body" weight="bold" color={Colors.primary}>{formatCurrency(product.price * quantity)}</Typography>
                  </View>
                </Card>
              ))}
            </View>

            <Card elevated style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Typography color={Colors.textSecondary}>Subtotal</Typography>
                <Typography weight="semibold">{formatCurrency(subtotal)}</Typography>
              </View>
              <View style={styles.summaryRow}>
                <Typography color={Colors.textSecondary}>Entrega ou retirada</Typography>
                <Typography variant="caption" color={Colors.textSecondary}>Definido no checkout</Typography>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Typography variant="title" weight="semibold">Total parcial</Typography>
                <Typography variant="title" weight="bold" color={Colors.primary}>{formatCurrency(subtotal)}</Typography>
              </View>
            </Card>
          </ScrollView>

          <View style={styles.footer}>
            <Button label="Continuar comprando" variant="outline" onPress={() => router.push('/catalog')} style={styles.footerButton} />
            <Button label="Ir para o checkout" onPress={() => router.push('/checkout' as never)} style={styles.footerButton} />
          </View>
        </>
      )}

      <AppModal
        visible={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        title="Remover produto"
        description={target ? `Remover “${target.product.name}” do carrinho?` : ''}
        type="error"
        destructive
        confirmLabel="Remover produto"
        cancelLabel="Manter no carrinho"
        onConfirm={() => {
          if (removeTarget) removeProduct(removeTarget);
          setRemoveTarget(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingTop: STATUS_BAR_HEIGHT + Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: Spacing.sm },
  content: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: Spacing.lg, paddingBottom: 140 },
  demoNotice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: 'rgba(255, 200, 87, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 200, 87, 0.24)' },
  noticeText: { flex: 1 },
  items: { gap: Spacing.md, marginVertical: Spacing.lg },
  itemCard: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  productIcon: { width: 52, height: 52, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(183, 255, 0, 0.08)' },
  itemCopy: { flex: 1, gap: 2 },
  itemAside: { alignSelf: 'stretch', alignItems: 'flex-end', justifyContent: 'space-between' },
  removeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  quantityRow: { marginTop: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  quantityButton: { width: 36, height: 36, borderRadius: Radius.full, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  quantityValue: { minWidth: 30 },
  disabled: { opacity: 0.4 },
  summaryCard: { gap: Spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  divider: { height: 1, backgroundColor: Colors.border },
  footer: { position: 'absolute', right: 0, bottom: 0, left: 0, flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border },
  footerButton: { flex: 1, maxWidth: 380 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  emptyIcon: { width: 80, height: 80, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(183, 255, 0, 0.08)' },
  emptyButton: { marginTop: Spacing.md, minWidth: 180 },
});
