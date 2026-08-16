import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Typography } from '../components/ui/Typography';
import { Colors, Radius, Spacing, STATUS_BAR_HEIGHT } from '../constants/theme';
import { useCart } from '../context/CartContext';
import { demoCatalog } from '../data/demoCatalog';
import type { CatalogProduct } from '../domain/catalog';
import { demoCatalogProvider } from '../services/demoCatalogProvider';
import { formatCurrency } from '../scripts/utils';

const categories = ['Todos', ...Array.from(new Set(demoCatalog.map((item) => item.category)))];

export default function CatalogScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { addProduct, itemCount } = useCart();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const columns = width >= 1100 ? 3 : width >= 700 ? 2 : 1;

  useEffect(() => {
    let active = true;
    setLoading(true);
    demoCatalogProvider.search({
      query,
      category: category === 'Todos' ? undefined : category,
      onlyAvailable: false,
    }).then((result) => {
      if (active) setProducts(result);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [category, query]);

  const listHeader = useMemo(() => (
    <>
      <View style={styles.demoNotice}>
        <Ionicons name="flask-outline" size={18} color={Colors.warning} />
        <View style={styles.noticeCopy}>
          <Typography variant="caption" weight="semibold" color={Colors.warning}>
            CATÁLOGO DE DEMONSTRAÇÃO
          </Typography>
          <Typography variant="caption" color={Colors.textSecondary}>
            Preços e estoque são exemplos para apresentar o fluxo ao mercado.
          </Typography>
        </View>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={20} color={Colors.textMuted} />
        <TextInput
          accessibilityLabel="Buscar no catálogo"
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar arroz, leite, limpeza..."
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <Pressable accessibilityLabel="Limpar busca" onPress={() => setQuery('')} style={styles.clearButton}>
            <Ionicons name="close" size={18} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.categoryList}
        renderItem={({ item }) => {
          const selected = category === item;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setCategory(item)}
              style={[styles.categoryChip, selected && styles.categoryChipSelected]}
            >
              <Typography
                variant="caption"
                weight="semibold"
                color={selected ? Colors.background : Colors.textSecondary}
              >
                {item}
              </Typography>
            </Pressable>
          );
        }}
      />

      <Typography variant="title" weight="semibold" style={styles.resultTitle}>
        {products.length} {products.length === 1 ? 'produto' : 'produtos'}
      </Typography>
    </>
  ), [category, products.length, query]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Typography variant="heading">Comprar online</Typography>
          <Typography variant="caption" color={Colors.textSecondary}>Mercado Parceiro</Typography>
        </View>
        <Pressable accessibilityLabel={`Abrir carrinho com ${itemCount} itens`} onPress={() => router.push('/cart')} style={styles.cartButton}>
          <Ionicons name="bag-handle-outline" size={24} color={Colors.textPrimary} />
          {itemCount > 0 && <View style={styles.cartBadge}><Typography variant="caption" weight="bold" color={Colors.background}>{itemCount}</Typography></View>}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primary} />
          <Typography color={Colors.textSecondary}>Carregando catálogo...</Typography>
        </View>
      ) : (
        <FlatList
          key={columns}
          data={products}
          numColumns={columns}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={(
            <View style={styles.centerState}>
              <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
              <Typography variant="title" weight="semibold">Nenhum produto encontrado</Typography>
              <Typography color={Colors.textSecondary} align="center">Tente outro termo ou categoria.</Typography>
            </View>
          )}
          contentContainerStyle={styles.content}
          columnWrapperStyle={columns > 1 ? styles.column : undefined}
          renderItem={({ item }) => (
            <Card style={[styles.productCard, columns > 1 && styles.productCardColumn]}>
              <View style={styles.productTopRow}>
                <View style={styles.productImage}>
                  <Ionicons name="basket-outline" size={30} color={Colors.primary} />
                </View>
                <Badge label={item.available ? 'Disponível' : 'Sem estoque'} variant={item.available ? 'primary' : 'error'} />
              </View>
              <View style={styles.productCopy}>
                <Typography variant="title" weight="semibold" numberOfLines={2}>{item.name}</Typography>
                <Typography variant="caption" color={Colors.textSecondary}>{item.brand ?? item.category} · {item.unit}</Typography>
              </View>
              <View style={styles.productFooter}>
                <View>
                  <Typography variant="title" weight="bold" color={Colors.primary}>{formatCurrency(item.price)}</Typography>
                  <Typography variant="caption" color={Colors.textMuted}>{item.stockQuantity} em estoque</Typography>
                </View>
                <Button
                  label={item.available ? 'Adicionar' : 'Indisponível'}
                  size="sm"
                  disabled={!item.available}
                  onPress={() => addProduct(item)}
                  leftIcon={<Ionicons name="add" size={18} color={item.available ? Colors.background : Colors.textMuted} />}
                  style={styles.addButton}
                />
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingTop: STATUS_BAR_HEIGHT + Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, marginLeft: Spacing.sm },
  cartButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  cartBadge: {
    position: 'absolute', top: 1, right: 0, minWidth: 20, height: 20,
    paddingHorizontal: 4, borderRadius: Radius.full, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  demoNotice: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, backgroundColor: 'rgba(255, 200, 87, 0.08)', borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(255, 200, 87, 0.24)' },
  noticeCopy: { flex: 1, gap: 2 },
  searchBox: { height: 52, marginTop: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.lg },
  searchInput: { flex: 1, height: '100%', color: Colors.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 16, outlineStyle: 'none' } as never,
  clearButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  categoryList: { gap: Spacing.sm, paddingVertical: Spacing.lg },
  categoryChip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.lg, borderRadius: Radius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  categoryChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  resultTitle: { marginBottom: Spacing.md },
  column: { gap: Spacing.md },
  productCard: { flex: 1, marginBottom: Spacing.md, gap: Spacing.md },
  productCardColumn: { minWidth: 0 },
  productTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  productImage: { width: 64, height: 64, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(183, 255, 0, 0.08)' },
  productCopy: { minHeight: 52, gap: 2 },
  productFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  addButton: { paddingHorizontal: Spacing.md },
  centerState: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
});
