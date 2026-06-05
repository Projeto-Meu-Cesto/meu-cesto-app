import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../../scripts/firebaseConfig';
import { cacheFinalizedPurchase } from '../../scripts/financeContext';
import { useToast } from '../../context/ToastContext';
import { PRIMARY_GREEN, BG_LIGHT, TEXT_DARK, TEXT_GRAY, DANGER, STATUS_BAR_HEIGHT } from '../../constants/theme';
import {
  parseMoney,
  getQuantity,
  getItemTotal,
  formatCurrency,
  normalizePriceTyping,
  normalizePriceForStorage,
  normalizeQuantityTyping,
  formatPriceForInput,
  wait
} from '../../scripts/utils';

const LIST_LOAD_TIMEOUT_MS = 4500;
const WRITE_TIMEOUT_MS = 1400;

type ShoppingListItem = {
  id: string;
  name?: string;
  price?: string | number;
  quantity?: string | number;
  category?: string;
  brand?: string;
  thumbnail?: string;
  checked?: boolean;
  checkedAt?: any;
};

type PriceModalMode = 'check' | 'mark-all' | 'finalize-checked' | 'finalize-all';

function findFirstMissingPrice(itemsToCheck: ShoppingListItem[]) {
  return itemsToCheck.find((item) => parseMoney(item.price) <= 0);
}



// — Skeleton Loader —
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
      style={[{ width: w, height: h, backgroundColor: '#E2E8F0', borderRadius: 10, opacity }, style]}
    />
  );
}

function SkeletonListItem() {
  return (
    <View style={skStyles.row}>
      <SkeletonBox width={22} height={22} style={{ borderRadius: 6, marginRight: 14 }} />
      <SkeletonBox width="55%" height={14} />
      <SkeletonBox width={40} height={14} style={{ marginLeft: 'auto' }} />
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
});

export default function ListsScreen() {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [priceModal, setPriceModal] = useState<{ item: ShoppingListItem; mode: PriceModalMode } | null>(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [quantityDraft, setQuantityDraft] = useState('1');
  const [priceSaving, setPriceSaving] = useState(false);
  const router = useRouter();
  const user = auth.currentUser;
  const { showToast } = useToast();

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Para recarregar os dados, invalide os caches se existirem.
    // Aqui usamos timeout curto mas o Firebase trata o background sync
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'shopping_list'),
      orderBy('createdAt', 'desc')
    );
    let receivedSnapshot = false;
    const loadingTimer = setTimeout(() => {
      if (!receivedSnapshot) {
        setLoading(false);
      }
    }, LIST_LOAD_TIMEOUT_MS);

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        receivedSnapshot = true;
        clearTimeout(loadingTimer);

        const list: ShoppingListItem[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setItems(list);
        setLoading(false);
      },
      (error) => {
        console.error('Erro ao carregar lista:', error);
        receivedSnapshot = true;
        clearTimeout(loadingTimer);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(loadingTimer);
      unsub();
    };
  }, [user]);

  const openPriceModal = (item: ShoppingListItem, mode: PriceModalMode) => {
    setPriceDraft(formatPriceForInput(item.price));
    setQuantityDraft(String(getQuantity(item.quantity)));
    setPriceModal({ item, mode });
  };

  const resolveWrite = async (writePromise: Promise<unknown>, label: string) => {
    const tracked = writePromise
      .then(() => 'saved' as const)
      .catch((error) => {
        console.error(label, error);
        return 'failed' as const;
      });

    const result = await Promise.race([
      tracked,
      wait(WRITE_TIMEOUT_MS).then(() => 'pending' as const),
    ]);

    if (result === 'pending') {
      tracked.then((finalResult) => {
        if (finalResult === 'failed') {
          console.warn(`${label} em segundo plano falhou.`);
        }
      });
    }

    return result;
  };

  const updateLocalItem = (itemId: string, patch: Partial<ShoppingListItem>) => {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item
      )
    );
  };

  const removeLocalItems = (itemIds: string[]) => {
    const ids = new Set(itemIds);
    setItems((currentItems) => currentItems.filter((item) => !ids.has(item.id)));
  };

  const toggleItem = async (item: ShoppingListItem) => {
    if (!user) return;

    if (!item.checked && parseMoney(item.price) <= 0) {
      openPriceModal(item, 'check');
      return;
    }

    try {
      const nextChecked = !item.checked;
      const checkedAt = item.checked ? null : Timestamp.now();
      const itemRef = doc(db, 'users', user.uid, 'shopping_list', item.id);
      updateLocalItem(item.id, { checked: nextChecked, checkedAt });
      const result = await resolveWrite(
        updateDoc(itemRef, {
          checked: nextChecked,
          checkedAt,
        }),
        'Erro ao atualizar item'
      );

      if (result === 'failed') {
        updateLocalItem(item.id, { checked: item.checked, checkedAt: item.checkedAt });
        Alert.alert('Erro', 'Não foi possível atualizar o item agora.');
      }
    } catch (error) {
      console.error("Erro ao atualizar item:", error);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!user) return;
    
    // Optimistic Update: guarda o item caso dê erro
    const itemToRestore = items.find(i => i.id === itemId);
    if (!itemToRestore) return;
    
    // Remove localmente antes de terminar na rede
    removeLocalItems([itemId]);
    
    try {
      const itemRef = doc(db, 'users', user.uid, 'shopping_list', itemId);
      await deleteDoc(itemRef);
      // Sucesso silenciado, a UI já reagiu.
    } catch (error) {
      console.error("Erro ao deletar item:", error);
      Alert.alert('Erro', 'Não foi possível excluir o item. Tente novamente.');
      // Rollback: restaura o item na UI
      setItems(prev => [itemToRestore, ...prev]);
    }
  };

  const alreadyInCart = items.filter(item => item.checked);
  const stillMissing = items.filter(item => !item.checked);

  const runBulkAction = async (
    targetItems: ShoppingListItem[],
    action: 'mark-checked' | 'mark-pending' | 'delete'
  ) => {
    if (!user || targetItems.length === 0) return;

    setBulkLoading(true);
    try {
      const batch = writeBatch(db);

      targetItems.forEach((item) => {
        const itemRef = doc(db, 'users', user.uid, 'shopping_list', item.id);

        if (action === 'delete') {
          batch.delete(itemRef);
          return;
        }

        batch.update(itemRef, {
          checked: action === 'mark-checked',
          checkedAt: action === 'mark-checked' ? Timestamp.now() : null,
        });
      });

      const result = await resolveWrite(batch.commit(), 'Erro ao executar ação da lista');

      if (result !== 'failed') {
        if (action === 'delete') {
          removeLocalItems(targetItems.map((item) => item.id));
        } else {
          const checked = action === 'mark-checked';
          const checkedAt = checked ? Timestamp.now() : null;
          setItems((currentItems) =>
            currentItems.map((item) =>
              targetItems.some((targetItem) => targetItem.id === item.id)
                ? { ...item, checked, checkedAt }
                : item
            )
          );
        }
      }

      if (result === 'failed') {
        Alert.alert('Erro', 'Não foi possível atualizar a lista agora.');
      }
    } catch (error) {
      console.error('Erro ao executar ação da lista:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a lista agora.');
    } finally {
      setBulkLoading(false);
    }
  };

  const confirmAndRun = (
    title: string,
    message: string,
    onConfirm: () => void,
    destructive = false
  ) => {
    setMenuOpen(false);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: destructive ? 'Confirmar' : 'OK',
        style: destructive ? 'destructive' : 'default',
        onPress: onConfirm,
      },
    ]);
  };

  const finalizePurchase = async (targetItems = alreadyInCart) => {
    if (!user || targetItems.length === 0) return;

    const missingPrice = findFirstMissingPrice(targetItems);
    if (missingPrice) {
      openPriceModal(missingPrice, targetItems.length === items.length ? 'finalize-all' : 'finalize-checked');
      return;
    }

    setBulkLoading(true);
    try {
      const now = Timestamp.now();
      const purchaseItems = targetItems.map((item) => ({
        sourceItemId: item.id,
        name: item.name || 'Item sem nome',
        price: item.price || '',
        quantity: getQuantity(item.quantity),
        category: item.category || 'Outros',
        brand: item.brand || '',
        thumbnail: item.thumbnail || '',
        total: getItemTotal(item),
        checkedAt: item.checkedAt || null,
      }));
      const purchaseTotal = purchaseItems.reduce((sum, item) => sum + item.total, 0);
      const batch = writeBatch(db);
      const purchaseRef = doc(collection(db, 'users', user.uid, 'purchases'));
      const cacheDate = new Date().toISOString();
      const purchaseRecord = {
        id: purchaseRef.id,
        items: purchaseItems,
        total: purchaseTotal,
        itemCount: purchaseItems.length,
        finalizedAt: cacheDate,
        createdAt: cacheDate,
        source: 'shopping_list',
      };

      await cacheFinalizedPurchase(user.uid, purchaseRecord);

      batch.set(purchaseRef, {
        items: purchaseItems,
        total: purchaseTotal,
        itemCount: purchaseItems.length,
        finalizedAt: now,
        createdAt: now,
        source: 'shopping_list',
      });

      targetItems.forEach((item) => {
        const itemRef = doc(db, 'users', user.uid, 'shopping_list', item.id);
        batch.delete(itemRef);
      });

      const result = await resolveWrite(batch.commit(), 'Erro ao finalizar compra');

      if (result !== 'failed') {
        removeLocalItems(targetItems.map((item) => item.id));
        showToast('Compra finalizada com sucesso!', 'success'); // BUG FIX #10
      }

      if (result === 'failed') {
        Alert.alert('Erro', 'Não foi possível finalizar a compra agora.');
      }
    } catch (error) {
      console.error('Erro ao finalizar compra:', error);
      Alert.alert('Erro', 'Não foi possível finalizar a compra agora.');
    } finally {
      setBulkLoading(false);
    }
  };

  const markAllInCart = async (sourceItems = items) => {
    const missingPrice = findFirstMissingPrice(sourceItems);
    if (missingPrice) {
      openPriceModal(missingPrice, 'mark-all');
      return;
    }

    await runBulkAction(sourceItems.filter((item) => !item.checked), 'mark-checked');
  };

  const finalizeChecked = (sourceItems = alreadyInCart) => {
    finalizePurchase(sourceItems);
  };

  const finalizeAll = (sourceItems = items) => {
    const missingPrice = findFirstMissingPrice(sourceItems);
    if (missingPrice) {
      openPriceModal(missingPrice, 'finalize-all');
      return;
    }

    finalizePurchase(sourceItems);
  };

  const savePriceAndContinue = async () => {
    if (!user || !priceModal || priceSaving) return;

    const cleanPrice = normalizePriceForStorage(priceDraft);
    const quantity = getQuantity(quantityDraft);

    if (!cleanPrice) {
      Alert.alert('Preço obrigatório', 'Informe o preço do item para marcar como comprado.');
      return;
    }

    setPriceSaving(true);
    try {
      const checkedAt = Timestamp.now();
      const itemRef = doc(db, 'users', user.uid, 'shopping_list', priceModal.item.id);
      const previousItem = priceModal.item;
      const patch = {
        price: cleanPrice,
        quantity,
        checked: true,
        checkedAt,
      };

      updateLocalItem(priceModal.item.id, patch);
      const result = await resolveWrite(
        updateDoc(itemRef, patch),
        'Erro ao salvar preço do item'
      );

      if (result === 'failed') {
        updateLocalItem(previousItem.id, {
          price: previousItem.price,
          quantity: previousItem.quantity,
          checked: previousItem.checked,
          checkedAt: previousItem.checkedAt,
        });
        Alert.alert('Erro', 'Não foi possível salvar o preço agora.');
        return;
      }

      const updatedItems = items.map((item) => {
        if (item.id !== priceModal.item.id) return item;
        return {
          ...item,
          ...patch,
        };
      });

      const updatedChecked = updatedItems.filter((item) => item.checked);
      const mode = priceModal.mode;
      setPriceModal(null);
      setPriceDraft('');
      setQuantityDraft('1');

      if (mode === 'mark-all') {
        await markAllInCart(updatedItems);
      } else if (mode === 'finalize-all') {
        finalizeAll(updatedItems);
      } else if (mode === 'finalize-checked') {
        finalizeChecked(updatedChecked);
      }
    } catch (error) {
      console.error('Erro ao salvar preço do item:', error);
      Alert.alert('Erro', 'Não foi possível salvar o preço agora.');
    } finally {
      setPriceSaving(false);
    }
  };

  const totalEstimated = items.reduce((acc, item) => {
    return acc + getItemTotal(item);
  }, 0);

  const totalInCart = alreadyInCart.reduce((acc, item) => {
    return acc + getItemTotal(item);
  }, 0);

  const progress = items.length > 0 ? alreadyInCart.length / items.length : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_GREEN} translucent />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ width: 44 }} />
          <Text style={styles.headerTitle}>Minha lista</Text>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setMenuOpen(true)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Abrir ações da lista"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressLabel}>No carrinho</Text>
              <Text style={styles.progressAmount}>{formatCurrency(totalInCart)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.progressLabel}>Total estimado</Text>
              <Text style={styles.progressAmount}>{formatCurrency(totalEstimated)}</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` as any }]} />
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY_GREEN}
            colors={[PRIMARY_GREEN]}
          />
        }
      >
        {loading ? (
          <>
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
            <SkeletonListItem />
          </>
        ) : (
          <>
            {stillMissing.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>MINHA LISTA DE COMPRAS</Text>
                <View style={styles.listSection}>
                  {stillMissing.map((item) => (
                    <ShoppingItem
                      key={item.id}
                      itemId={item.id}
                      item={item}
                      checked={false}
                      onPress={() => toggleItem(item)}
                      handleDelete={handleDelete}
                    />
                  ))}
                </View>
              </>
            )}

            {alreadyInCart.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>JÁ NO CARRINHO</Text>
                <View style={styles.listSection}>
                  {alreadyInCart.map((item) => (
                    <ShoppingItem
                      key={item.id}
                      itemId={item.id}
                      item={item}
                      checked={true}
                      onPress={() => toggleItem(item)}
                      handleDelete={handleDelete}
                    />
                  ))}
                  <TouchableOpacity
                    style={[styles.finalizeButton, bulkLoading && styles.finalizeButtonDisabled]}
                    onPress={() =>
                      confirmAndRun(
                        'Finalizar comprados',
                        `Vou salvar ${alreadyInCart.length} item(ns), total ${formatCurrency(totalInCart)}, e limpar esses itens da lista atual.`,
                        () => finalizeChecked()
                      )
                    }
                    disabled={bulkLoading}
                    activeOpacity={0.85}
                  >
                    {bulkLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="receipt-outline" size={18} color="#fff" />
                        <Text style={styles.finalizeButtonText}>Finalizar comprados</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}

            {items.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="cart-outline" size={60} color="#CBD5E1" />
                <Text style={styles.emptyText}>Sua lista está vazia.</Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/addItem')}>
                  <Text style={styles.emptyButtonText}>Adicionar primeiro item</Text>
                </TouchableOpacity>
              </View>
            )}

            {stillMissing.length > 0 && (
              <TouchableOpacity
                style={[styles.finalizeAllButton, bulkLoading && styles.finalizeButtonDisabled]}
                onPress={() =>
                  confirmAndRun(
                    'Finalizar lista inteira',
                    `Vou salvar todos os ${items.length} item(ns) da lista no histórico. Se faltar preço, vou pedir antes de finalizar.`,
                    () => finalizeAll()
                  )
                }
                disabled={bulkLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-done-outline" size={18} color={PRIMARY_GREEN} />
                <Text style={styles.finalizeAllButtonText}>Finalizar lista inteira</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/addItem')}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuOverlay}>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuTitle}>Ações da lista</Text>
                <Text style={styles.menuSubtitle}>
                  {items.length > 0 ? `${items.length} item(ns) na lista` : 'Sua lista está vazia'}
                </Text>
              </View>
              <TouchableOpacity style={styles.menuCloseButton} onPress={() => setMenuOpen(false)}>
                <Ionicons name="close" size={20} color={TEXT_DARK} />
              </TouchableOpacity>
            </View>

            {bulkLoading ? (
              <View style={styles.menuLoading}>
                <ActivityIndicator color={PRIMARY_GREEN} />
                <Text style={styles.menuLoadingText}>Atualizando lista...</Text>
              </View>
            ) : (
              <View style={styles.menuOptions}>
                <MenuOption
                  icon="receipt-outline"
                  title="Finalizar comprados"
                  subtitle="Salva só os itens marcados com check."
                  disabled={alreadyInCart.length === 0}
                  onPress={() =>
                    confirmAndRun(
                      'Finalizar comprados',
                      `Vou salvar ${alreadyInCart.length} item(ns), total ${formatCurrency(totalInCart)}, e limpar esses itens da lista atual.`,
                      () => finalizeChecked()
                    )
                  }
                />
                {stillMissing.length > 0 && (
                  <MenuOption
                    icon="checkmark-done-outline"
                    title="Finalizar lista inteira"
                    subtitle="Salva pendentes e comprados de uma vez."
                    disabled={items.length === 0}
                    onPress={() =>
                      confirmAndRun(
                        'Finalizar lista inteira',
                        `Vou salvar todos os ${items.length} item(ns) da lista. Se faltar preço, vou pedir antes de finalizar.`,
                        () => finalizeAll()
                      )
                    }
                  />
                )}
                <MenuOption
                  icon="checkmark-done-outline"
                  title="Marcar tudo no carrinho"
                  subtitle="Pede preço do que estiver sem valor antes de marcar."
                  disabled={stillMissing.length === 0}
                  onPress={() => {
                    setMenuOpen(false);
                    markAllInCart();
                  }}
                />
                <MenuOption
                  icon="refresh-outline"
                  title="Desmarcar tudo"
                  subtitle="Volta os itens comprados para pendentes."
                  disabled={alreadyInCart.length === 0}
                  onPress={() => {
                    setMenuOpen(false);
                    runBulkAction(alreadyInCart, 'mark-pending');
                  }}
                />
                <MenuOption
                  icon="trash-bin-outline"
                  title="Limpar lista inteira"
                  subtitle="Descarta a lista atual sem salvar no histórico."
                  danger
                  disabled={items.length === 0}
                  onPress={() =>
                    confirmAndRun(
                      'Limpar lista inteira',
                      `Isso vai apagar ${items.length} item(ns) sem salvar no histórico. Essa ação não tem volta.`,
                      () => runBulkAction(items, 'delete'),
                      true
                    )
                  }
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(priceModal)}
        transparent
        animationType="fade"
        onRequestClose={() => setPriceModal(null)}
      >
        <KeyboardAvoidingView
          style={styles.priceModalKeyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? -24 : 0}
        >
          <View style={styles.priceModalOverlay}>
            <Pressable style={styles.priceModalBackdrop} onPress={() => setPriceModal(null)} />
            <View style={styles.priceModalCard}>
              <View style={styles.priceModalHeader}>
                <View>
                  <Text style={styles.priceModalTitle}>Preço no mercado</Text>
                  <Text style={styles.priceModalSubtitle}>
                    {priceModal?.item.name || 'Item da lista'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.menuCloseButton} onPress={() => setPriceModal(null)}>
                  <Ionicons name="close" size={20} color={TEXT_DARK} />
                </TouchableOpacity>
              </View>

              <View style={styles.priceInputRow}>
                <View style={[styles.priceField, styles.priceFieldWide]}>
                  <Text style={styles.priceFieldLabel}>Preço unitário</Text>
                  <TextInput
                    style={styles.priceTextInput}
                    placeholder="Ex: 4,99"
                    value={priceDraft}
                    onChangeText={(value) => setPriceDraft(normalizePriceTyping(value))}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#94A3B8"
                    autoFocus
                  />
                </View>

                <View style={styles.priceField}>
                  <Text style={styles.priceFieldLabel}>Qtd.</Text>
                  <TextInput
                    style={styles.priceTextInput}
                    placeholder="1"
                    value={quantityDraft}
                    onChangeText={(value) => setQuantityDraft(normalizeQuantityTyping(value))}
                    keyboardType="number-pad"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.savePriceButton, priceSaving && styles.finalizeButtonDisabled]}
                onPress={savePriceAndContinue}
                disabled={priceSaving}
                activeOpacity={0.85}
              >
                {priceSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-outline" size={18} color="#fff" />
                    <Text style={styles.savePriceButtonText}>Salvar e marcar comprado</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function MenuOption({
  icon,
  title,
  subtitle,
  danger = false,
  disabled = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = danger ? DANGER : PRIMARY_GREEN;

  return (
    <TouchableOpacity
      style={[styles.menuOption, disabled && styles.menuOptionDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <View style={[styles.menuOptionIcon, { backgroundColor: danger ? '#FEE2E2' : '#DCFCE7' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={styles.menuOptionText}>
        <Text style={[styles.menuOptionTitle, danger && { color: DANGER }]}>{title}</Text>
        <Text style={styles.menuOptionSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ShoppingItem({
  item,
  checked,
  onPress,
  handleDelete,
  itemId,
}: {
  item: ShoppingListItem;
  checked: boolean;
  onPress: () => void;
  handleDelete: (itemId: string) => void;
  itemId: string;
}) {
  const quantity = getQuantity(item.quantity);
  const unitPrice = parseMoney(item.price);
  const itemTotal = getItemTotal(item);
  const missingPrice = unitPrice <= 0;

  return (
    <View style={styles.itemRow}>
      <TouchableOpacity style={styles.itemLeft} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <View style={styles.itemTextBlock}>
          <Text style={[styles.itemName, checked && styles.itemNameChecked]}>{item.name}</Text>
          {missingPrice ? (
            <Text style={styles.itemMeta}>Toque para informar preço e qtd.</Text>
          ) : quantity > 1 ? (
            <Text style={[styles.itemMeta, checked && styles.itemMetaChecked]}>
              {quantity} un. x {formatCurrency(unitPrice)}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <View style={styles.itemRight}>
        {itemTotal > 0 ? (
          <Text style={[styles.itemPrice, checked && styles.itemPriceChecked]}>
            {formatCurrency(itemTotal)}
          </Text>
        ) : null}
        <TouchableOpacity onPress={() => handleDelete(itemId)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color="#FF5252" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingHorizontal: 20,
    paddingTop: STATUS_BAR_HEIGHT,
    paddingBottom: 25,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  progressLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  progressAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 4,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 130,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 15,
  },
  listSection: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemTextBlock: {
    flex: 1,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: PRIMARY_GREEN,
    borderColor: PRIMARY_GREEN,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
    flexShrink: 1,
  },
  itemNameChecked: {
    color: '#CBD5E1',
    textDecorationLine: 'line-through',
    fontWeight: '600',
  },
  itemMeta: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  itemMetaChecked: {
    color: '#CBD5E1',
  },
  finalizeButton: {
    height: 48,
    borderRadius: 16,
    backgroundColor: PRIMARY_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  finalizeButtonDisabled: {
    opacity: 0.75,
  },
  finalizeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  finalizeAllButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  finalizeAllButtonText: {
    color: PRIMARY_GREEN,
    fontSize: 14,
    fontWeight: '900',
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_GRAY,
  },
  itemPriceChecked: {
    color: '#E2E8F0',
  },
  deleteBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 25,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 16,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  fab: {
    position: 'absolute',
    bottom: 110,
    right: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PRIMARY_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  menuOverlay: {
    flex: 1,
    alignItems: 'flex-end',
    paddingTop: STATUS_BAR_HEIGHT + 58,
    paddingHorizontal: 14,
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  menuSheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  menuSubtitle: {
    color: TEXT_GRAY,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  menuCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BG_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLoading: {
    minHeight: 132,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  menuLoadingText: {
    color: TEXT_GRAY,
    fontSize: 13,
    fontWeight: '700',
  },
  menuOptions: {
    gap: 10,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    backgroundColor: BG_LIGHT,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuOptionDisabled: {
    opacity: 0.45,
  },
  menuOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOptionText: {
    flex: 1,
  },
  menuOptionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  menuOptionSubtitle: {
    color: TEXT_GRAY,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 3,
  },
  priceModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  priceModalKeyboard: {
    flex: 1,
  },
  priceModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  priceModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
  },
  priceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  priceModalTitle: {
    color: TEXT_DARK,
    fontSize: 20,
    fontWeight: '900',
  },
  priceModalSubtitle: {
    color: TEXT_GRAY,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
    maxWidth: 270,
  },
  priceInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  priceField: {
    width: 105,
    backgroundColor: BG_LIGHT,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  priceFieldWide: {
    flex: 1,
    width: undefined,
  },
  priceFieldLabel: {
    color: TEXT_GRAY,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 2,
  },
  priceTextInput: {
    height: 42,
    color: TEXT_DARK,
    fontSize: 18,
    fontWeight: '900',
    borderWidth: 0,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  savePriceButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: PRIMARY_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  savePriceButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
