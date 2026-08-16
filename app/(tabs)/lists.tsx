import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInUp, FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { db, auth } from '../../scripts/firebaseConfig';
import { getCachedLocation } from '../../scripts/locationService';
import { Colors, Spacing, Radius, STATUS_BAR_HEIGHT } from '../../constants/theme';
import { getItemTotal, getQuantity, parseMoney, wait } from '../../scripts/utils';
import { cacheFinalizedPurchase, PurchaseRecord } from '../../scripts/financeContext';

// UI components
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Button } from '../../components/ui/Button';
import { useSidebar } from '../../components/ui/Sidebar';

const { width } = Dimensions.get('window');
const LOCATION_MODAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const saveFinalizedPurchase = async (uid: string, checkedItems: ListItem[]) => {
  const purchaseData = {
    items: checkedItems.map((item) => ({
      sourceItemId: item.id,
      name: item.name || '',
      price: item.price || 0,
      quantity: item.quantity || 1,
      category: item.category || 'Outros',
      checkedAt: item.checkedAt || new Date().toISOString(),
    })),
    total: checkedItems.reduce((sum, item) => sum + getItemTotal(item), 0),
    itemCount: checkedItems.length,
    finalizedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    source: 'app',
  };

  const docRef = await addDoc(collection(db, 'users', uid, 'purchases'), purchaseData);
  await cacheFinalizedPurchase(uid, { id: docRef.id, ...purchaseData });
};

type ListItem = {
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

// Checkbox animation component
function AnimatedCheckbox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.85, { damping: 10, stiffness: 350 }, (finished) => {
      if (finished) scale.value = withSpring(1, { damping: 10, stiffness: 350 });
    });
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.checkboxPressArea}>
      <Animated.View style={[
        styles.checkboxSquare, 
        checked && styles.checkboxSquareChecked,
        animStyle
      ]}>
        {checked && <Ionicons name="checkmark" size={14} color="#080A09" />}
      </Animated.View>
    </Pressable>
  );
}

export default function ListsScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const { setVisible: setSidebarVisible } = useSidebar();

  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Modal input state
  const [activeItem, setActiveItem] = useState<ListItem | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [savingItem, setSavingItem] = useState(false);

  // checkout prompt states
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [checkoutSaving, setCheckoutSaving] = useState(false);

  // location warning state
  const [locationWarnVisible, setLocationWarnVisible] = useState(false);

  // Sync firestore
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const shoppingQuery = query(
      collection(db, 'users', user.uid, 'shopping_list'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(shoppingQuery, (snapshot) => {
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ListItem[];

      setItems(loaded);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Check location filter suggestion cooldown on startup
  useEffect(() => {
    const checkLocationSuggest = async () => {
      const enabled = await AsyncStorage.getItem('@meu-cesto:location-filter-enabled');
      if (enabled === 'false') return;

      const lastPrompt = await AsyncStorage.getItem('@meu-cesto:location-prompt-time');
      const now = Date.now();
      if (lastPrompt && now - parseInt(lastPrompt) < LOCATION_MODAL_COOLDOWN_MS) return;

      const cache = await getCachedLocation();
      if (!cache) {
        setLocationWarnVisible(true);
      }
    };
    checkLocationSuggest();
  }, []);

  const handleToggleCheck = async (item: ListItem) => {
    if (!user) return;
    const nextCheck = !item.checked;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // If item is being checked, prompt for price/qty edit if empty
    if (nextCheck && (!item.price || !item.quantity)) {
      setActiveItem(item);
      setEditPrice(item.price ? String(item.price) : '0.00');
      setEditQuantity(item.quantity ? String(item.quantity) : '1');
      return;
    }

    try {
      const itemRef = doc(db, 'users', user.uid, 'shopping_list', item.id);
      await updateDoc(itemRef, {
        checked: nextCheck,
        checkedAt: nextCheck ? new Date().toISOString() : null,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveItemDetails = async () => {
    if (!user || !activeItem) return;
    setSavingItem(true);
    try {
      const itemRef = doc(db, 'users', user.uid, 'shopping_list', activeItem.id);
      await updateDoc(itemRef, {
        price: editPrice.replace(',', '.'),
        quantity: editQuantity,
        checked: true,
        checkedAt: new Date().toISOString(),
      });
      setActiveItem(null);
    } catch (error) {
      console.error(error);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!user) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'shopping_list', itemId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCheckout = async () => {
    if (!user || items.length === 0) return;
    setCheckoutSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const checked = items.filter(i => i.checked);
      if (checked.length > 0) {
        // Save to monthly history
        await saveFinalizedPurchase(user.uid, checked);

        // Delete from active list
        const deletePromises = checked.map((i) =>
          deleteDoc(doc(db, 'users', user.uid, 'shopping_list', i.id))
        );
        await Promise.all(deletePromises);
      }
      setCheckoutVisible(false);
    } catch (error) {
      console.error(error);
    } finally {
      setCheckoutSaving(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await wait(800);
    setIsRefreshing(false);
  };

  const handleConfigureLocation = async () => {
    await AsyncStorage.setItem('@meu-cesto:location-prompt-time', String(Date.now()));
    setLocationWarnVisible(false);
    router.push('/profile');
  };

  const handleDismissLocationWarn = async () => {
    await AsyncStorage.setItem('@meu-cesto:location-prompt-time', String(Date.now()));
    setLocationWarnVisible(false);
  };

  // Calculations
  const checkedCount = items.filter(i => i.checked).length;
  const progressPercent = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;
  
  const categoriesList = useMemo(() => {
    const cats = new Set<string>();
    cats.add('Todos');
    items.forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory === 'Todos') return true;
      return item.category === selectedCategory;
    });
  }, [items, selectedCategory]);

  const totalEstimate = useMemo(() => {
    return items.reduce((sum, item) => sum + getItemTotal(item), 0);
  }, [items]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* IMAGE 5: HEADER */}
      <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarVisible(true)}>
            <Ionicons name="menu-outline" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Typography variant="caption" weight="heavy" color={Colors.primary} style={styles.topLabel}>
            MINHA ROTINA
          </Typography>
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Typography variant="display" weight="heavy" color={Colors.textPrimary} style={styles.title}>
          Lista da semana
        </Typography>
        <Typography variant="body" color={Colors.textMuted} style={styles.subtitle}>
          {checkedCount} de {items.length} itens organizados
        </Typography>
      </Animated.View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* IMAGE 5: PROGRESS CARD */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <Card elevated style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                Progresso da compra
              </Typography>
              <Typography variant="display" weight="heavy" color={Colors.primary}>
                {progressPercent}%
              </Typography>
            </View>

            <ProgressBar progress={progressPercent / 100} color={Colors.primary} height={6} />

            <View style={styles.progressFooter}>
              <Typography variant="caption" color={Colors.primary} style={{ flex: 1 }}>
                Você está no caminho certo
              </Typography>
              <View style={{ alignItems: 'flex-end' }}>
                <Typography variant="caption" color={Colors.textMuted}>
                  Subtotal estimado
                </Typography>
                <Typography variant="body" weight="heavy" color={Colors.textPrimary}>
                  {formatCurrency(totalEstimate)}
                </Typography>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* IMAGE 5: FILTER CHIPS */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
            {categoriesList.map((cat) => {
              const active = cat === selectedCategory;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCategory(cat);
                  }}
                  style={[styles.chipButton, active && styles.chipButtonActive]}
                >
                  <Typography variant="caption" weight="semibold" color={active ? Colors.primary : Colors.textSecondary}>
                    {cat}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* LIST SECTION HEADER & FAB ADD */}
        <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.listSectionHeader}>
          <Typography variant="body" weight="bold" color={Colors.textPrimary}>
            Itens da lista <Typography variant="caption" color={Colors.primary}>{filteredItems.length} itens</Typography>
          </Typography>
          
          <TouchableOpacity
            style={styles.floatingAddBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/addItem');
            }}
          >
            <Ionicons name="add" size={20} color="#080A09" />
          </TouchableOpacity>
        </Animated.View>

        {/* ITEMS LIST */}
        <View style={styles.itemsListContainer}>
          {filteredItems.map((item, idx) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(idx * 50 + 300).duration(400)}>
              <Card elevated style={[styles.itemCard, item.checked && styles.itemCardChecked]}>
                <View style={styles.itemRow}>
                  <AnimatedCheckbox checked={Boolean(item.checked)} onPress={() => handleToggleCheck(item)} />
                  
                  <View style={{ flex: 1 }}>
                    <Typography 
                      variant="body" 
                      weight="bold" 
                      color={item.checked ? Colors.textMuted : Colors.textPrimary}
                      style={item.checked && styles.textLineThrough}
                    >
                      {item.name}
                    </Typography>
                    <Typography variant="caption" color={Colors.textMuted} style={{ marginTop: 2 }}>
                      {item.category || 'Outros'}
                    </Typography>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                      {formatCurrency(getItemTotal(item))}
                    </Typography>
                    {Boolean(item.price) && (
                      <Typography variant="caption" color={Colors.textMuted}>
                        {item.quantity} x {formatCurrency(parseMoney(item.price))}
                      </Typography>
                    )}
                  </View>

                  <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </Card>
            </Animated.View>
          ))}
        </View>

        {checkedCount > 0 && (
          <Button
            variant="primary"
            label="Concluir Cesto"
            leftIcon={<Ionicons name="cart-outline" size={18} color="#080A09" />}
            onPress={() => setCheckoutVisible(true)}
            style={styles.checkoutBtn}
          />
        )}
      </ScrollView>

      {/* Modal 1: Edit Item details */}
      <Modal visible={activeItem !== null} transparent animationType="slide" onRequestClose={() => setActiveItem(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="title" weight="bold" color={Colors.textPrimary}>Confirmar Detalhes</Typography>
              <TouchableOpacity onPress={() => setActiveItem(null)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Typography variant="body" weight="bold" color={Colors.textPrimary} style={{ marginBottom: Spacing.md }}>
              {activeItem?.name}
            </Typography>

            <View style={styles.inputGroup}>
              <View style={{ flex: 1 }}>
                <Typography variant="caption" weight="bold" color={Colors.textSecondary} style={{ marginBottom: 4 }}>PREÇO R$</Typography>
                <TextInput
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  value={editPrice}
                  onChangeText={setEditPrice}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Typography variant="caption" weight="bold" color={Colors.textSecondary} style={{ marginBottom: 4 }}>QUANTIDADE</Typography>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  value={editQuantity}
                  onChangeText={setEditQuantity}
                  placeholder="1"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>

            <Button
              variant="primary"
              label="Salvar no carrinho"
              loading={savingItem}
              onPress={handleSaveItemDetails}
              style={{ marginTop: Spacing.xl }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal 2: Checkout prompt */}
      <Modal visible={checkoutVisible} transparent animationType="fade" onRequestClose={() => setCheckoutVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="title" weight="bold" color={Colors.textPrimary}>Finalizar compra</Typography>
              <TouchableOpacity onPress={() => setCheckoutVisible(false)} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Typography variant="body" color={Colors.textPrimary} style={{ lineHeight: 22, marginBottom: Spacing.lg }}>
              Ao finalizar, os **{checkedCount} itens** do carrinho serão salvos no histórico financeiro de gastos e limpos da sua lista atual. Deseja prosseguir?
            </Typography>

            <Button
              variant="primary"
              label="Sim, registrar e limpar"
              loading={checkoutSaving}
              onPress={handleCheckout}
            />
          </View>
        </View>
      </Modal>

      {/* Modal 3: Location warning */}
      <Modal visible={locationWarnVisible} transparent animationType="fade" onRequestClose={handleDismissLocationWarn}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="title" weight="bold" color={Colors.textPrimary}>Localização inativa</Typography>
              <TouchableOpacity onPress={handleDismissLocationWarn} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Typography variant="body" color={Colors.textPrimary} style={{ lineHeight: 22, marginBottom: Spacing.lg }}>
              Ative o filtro regional no seu Perfil para que o Luca possa sugerir produtos e ofertas com preços específicos da sua cidade.
            </Typography>

            <View style={{ gap: Spacing.sm }}>
              <Button variant="primary" label="Configurar agora" onPress={handleConfigureLocation} />
              <Button variant="outline" label="Talvez mais tarde" onPress={handleDismissLocationWarn} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
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
    marginBottom: Spacing.md,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 130,
    gap: Spacing.xl,
  },
  progressCard: {
    borderColor: Colors.border,
    borderWidth: 1,
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  chipsContainer: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  chipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  chipButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: '#080A09',
  },
  listSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  floatingAddBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsListContainer: {
    gap: Spacing.md,
  },
  itemCard: {
    borderColor: Colors.border,
    borderWidth: 1,
    padding: Spacing.md,
  },
  itemCardChecked: {
    opacity: 0.65,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  checkboxPressArea: {
    padding: 4,
  },
  checkboxSquare: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareChecked: {
    backgroundColor: Colors.primary,
  },
  textLineThrough: {
    textDecorationLine: 'line-through',
  },
  deleteBtn: {
    padding: 8,
  },
  checkoutBtn: {
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalContent: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xxxl,
  },
  modalHeader: {
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
  inputGroup: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  textInput: {
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
});
