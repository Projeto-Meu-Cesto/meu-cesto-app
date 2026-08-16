import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Timestamp, addDoc, collection } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Pressable
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors, Spacing, Radius, STATUS_BAR_HEIGHT_SM as STATUS_BAR_HEIGHT } from '../constants/theme';
import { useToast } from '../context/ToastContext';
import { categorizeProductLocal, filterProductsByRegionWithAI } from '../scripts/aiService';
import { auth, db } from '../scripts/firebaseConfig';
import {
  UserLocation,
  checkLocationPermission,
  formatLocationLabel,
  getCachedLocation,
  requestUserLocation,
} from '../scripts/locationService';
import {
  Product,
  fetchFallbackImage,
  fetchProductsByName,
  getProductImageUrl,
  hasProductImage,
} from '../scripts/productService';
import { wait } from '../scripts/utils';

// UI components
import { Typography } from '../components/ui/Typography';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

const SAVE_TIMEOUT_MS = 1400;

type ItemPayload = {
  name: string;
  price: string;
  quantity: number;
  brand: string;
  thumbnail: string;
  checked: boolean;
  category: string;
  createdAt: Timestamp;
  checkedAt: null;
};

function itemKey(item: Product) {
  return String(item.barcode || item.gtin);
}

export default function AddItemScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>({});
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Product[]>([]);
  const [selectedItems, setSelectedItems] = useState<Product[]>([]);
  const [activeFilter, setActiveFilter] = useState('Tudo');
  const [selectedDetailItem, setSelectedDetailItem] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [detailImage, setDetailImage] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationModal, setLocationModal] = useState(false);
  const filters = ['Tudo', 'Frutas', 'Laticínios', 'Limpeza', 'Higiene', 'Bebidas', 'Padaria', 'Carnes'];
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const user = auth.currentUser;
  const { showToast } = useToast();

  useEffect(() => {
    const initLocation = async () => {
      const enabledRaw = await AsyncStorage.getItem('@meu-cesto:location-filter-enabled');
      const isFilterEnabled = enabledRaw === null ? true : enabledRaw === 'true';

      if (!isFilterEnabled) {
        return;
      }

      const cached = await getCachedLocation();
      if (cached) {
        setUserLocation(cached);
        return;
      }

      const perm = await checkLocationPermission();
      if (perm === 'granted') {
        setLocationLoading(true);
        const { location } = await requestUserLocation();
        setUserLocation(location);
        setLocationLoading(false);
      } else {
        setLocationModal(true);
      }
    };
    initLocation();
  }, []);

  const handleRequestLocation = useCallback(async () => {
    setLocationModal(false);
    setLocationLoading(true);
    const { location, status } = await requestUserLocation();
    setLocationLoading(false);
    if (status === 'granted' && location) {
      setUserLocation(location);
      showToast(`📍 Localização: ${formatLocationLabel(location)}`, 'success');
    } else if (status === 'denied') {
      Alert.alert(
        'Permissão necessária',
        'Não foi possível acessar a localização.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Configurações', onPress: () => Linking.openSettings() }
        ]
      );
    }
  }, [showToast]);

  useEffect(() => {
    let isActive = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!name || name.trim().length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const searchTerm = name.trim();
        const data = await fetchProductsByName(searchTerm);

        let finalResults = data || [];
        if (userLocation && finalResults.length > 0) {
          try {
            if (isActive) {
              finalResults = await filterProductsByRegionWithAI(finalResults, userLocation);
            }
          } catch (e) {
            console.warn('[AI Region Filter] Falhou ao filtrar por região:', e);
          }
        }

        if (isActive) {
          setResults(finalResults);
        }
      } catch {
        if (isActive) {
          console.warn('[Product] Busca indisponível. Você ainda pode adicionar manualmente.');
          setResults([]);
          showToast('Busca indisponível. Tente adicione manualmente.', 'info');
        }
      } finally {
        if (isActive) {
          setSearching(false);
        }
      }
    }, 900);

    return () => {
      isActive = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, userLocation]);

  const getItemQuantity = useCallback(
    (item: Product) => itemQuantities[itemKey(item)] ?? 1,
    [itemQuantities]
  );

  const changeItemQuantity = useCallback((item: Product, delta: number) => {
    const key = itemKey(item);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItemQuantities((prev) => {
      const next = Math.min(99, Math.max(1, (prev[key] ?? 1) + delta));
      return { ...prev, [key]: next };
    });
  }, []);

  const toggleSelection = (item: Product) => {
    const key = itemKey(item);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedItems((prev) => {
      const exists = prev.find((i) => itemKey(i) === key);
      if (exists) {
        setItemQuantities((qty) => {
          const next = { ...qty };
          delete next[key];
          return next;
        });
        return prev.filter((i) => itemKey(i) !== key);
      }
      setItemQuantities((qty) => ({ ...qty, [key]: qty[key] ?? 1 }));
      return [...prev, item];
    });
  };

  const hasSelection = selectedItems.length > 0;

  const handleAddItem = async () => {
    if (!user) {
      showToast('Você precisa estar logado.', 'error');
      return;
    }

    if (saving) return;

    if (selectedItems.length === 0) {
      showToast('Selecione um produto na lista para adicionar.', 'info');
      return;
    }

    setSaving(true);
    try {
      const payloads: ItemPayload[] = [];
      selectedItems.forEach((item) => {
        const itemName = item.name || item.description;
        const imageUrl = getProductImageUrl(item);
        const itemToAdd = {
          name: itemName,
          price: '',
          quantity: getItemQuantity(item),
          brand: item.brand || '',
          thumbnail: hasProductImage(item) ? imageUrl : '',
        };
        const category = categorizeProductLocal(itemName);

        payloads.push({
          ...itemToAdd,
          checked: false,
          category: category,
          createdAt: Timestamp.now(),
          checkedAt: null,
        });
      });

      const writes = payloads.map((payload) =>
        addDoc(collection(db, 'users', user.uid, 'shopping_list'), payload)
      );

      const saveResult = Promise.all(writes)
        .then(() => 'saved' as const)
        .catch((error) => {
          console.warn('[Lista] Erro ao salvar item:', error);
          return 'failed' as const;
        });

      const result = await Promise.race([
        saveResult,
        wait(SAVE_TIMEOUT_MS).then(() => 'pending' as const),
      ]);

      if (result === 'failed') {
        showToast('Não foi possível adicionar. Verifique sua conexão.', 'error');
        return;
      }

      if (result === 'pending') {
        saveResult.then((finalResult) => {
          if (finalResult === 'failed') {
            console.warn('[Lista] A gravação em segundo plano falhou.');
          }
        });
      }

      const count = payloads.length;
      showToast(
        count === 1
          ? `✅ "${payloads[0].name}" adicionado à lista!`
          : `✅ ${count} itens adicionados à lista!`,
        'success'
      );

      setName('');
      setItemQuantities({});
      setSelectedItems([]);
      router.replace('/lists');
    } catch {
      showToast('Não foi possível adicionar. Verifique sua conexão.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Typography variant="title" weight="bold" color={Colors.textPrimary}>
              Adicionar Item
            </Typography>
            <TouchableOpacity
              style={styles.locationBadge}
              onPress={() => setLocationModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="location-outline" size={12} color={Colors.primary} />
              {locationLoading ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 4 }} />
              ) : (
                <Typography variant="caption" color={Colors.primary} weight="semibold">
                  {userLocation ? formatLocationLabel(userLocation) : 'Definir localização'}
                </Typography>
              )}
            </TouchableOpacity>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <Card elevated style={styles.inputCard}>
          <Ionicons name="search-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Buscar por arroz, feijão, café..."
            value={name}
            onChangeText={setName}
            placeholderTextColor={Colors.textMuted}
            autoFocus
            autoCapitalize="sentences"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching && (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />
          )}
        </Card>
      </View>

      {/* Filters chips */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Typography variant="caption" weight="bold" color={activeFilter === filter ? '#080A09' : Colors.textPrimary}>
                {filter}
              </Typography>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.resultsScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Results List */}
        {!searching && results.length > 0 && (() => {
          const filtered = results.filter((item) => {
            if (activeFilter === 'Tudo') return true;
            return item.category === activeFilter;
          });

          return (
            <View style={styles.resultsContainer}>
              <Typography variant="caption" weight="bold" color={Colors.textMuted} style={styles.resultsTitle}>
                RESULTADOS ENCONTRADOS
              </Typography>
              {filtered.length === 0 && (
                <Typography variant="body" color={Colors.textMuted} style={styles.filterEmptyText}>
                  {`Nenhum resultado em "${activeFilter}". Troque o filtro ou refine a busca.`}
                </Typography>
              )}
              {filtered.map((item) => {
                const key = itemKey(item);
                const isSelected = selectedItems.some((i) => itemKey(i) === key);
                const imageUrl = getProductImageUrl(item);
                const qty = getItemQuantity(item);
                return (
                  <Card
                    key={key}
                    elevated={isSelected}
                    style={[styles.resultItem, isSelected && styles.resultItemActive]}
                  >
                    <Pressable
                      style={styles.resultPressable}
                      onPress={() => toggleSelection(item)}
                    >
                      <View style={styles.resultLeft}>
                        <View style={styles.resultThumb}>
                          {hasProductImage(item) ? (
                            <Image
                              source={{ uri: imageUrl }}
                              style={styles.resultThumbImg}
                              resizeMode="contain"
                            />
                          ) : (
                            <Ionicons name="cube-outline" size={20} color={Colors.textMuted} />
                          )}
                          {isSelected && (
                            <View style={styles.selectedOverlay}>
                              <Ionicons name="checkmark" size={14} color="#080A09" />
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Typography variant="caption" weight="bold" color={Colors.primary} style={styles.resultBrand}>
                            {item.brand || 'Marca n/i'}
                          </Typography>
                          <Typography variant="body" weight="semibold" color={Colors.textPrimary} numberOfLines={2}>
                            {item.name || item.description}
                          </Typography>
                          <TouchableOpacity
                            onPress={async (e) => {
                              e.stopPropagation();
                              setSelectedDetailItem(item);
                              setShowModal(true);
                              setDetailImage(null);
                              if (hasProductImage(item)) {
                                setDetailImage(imageUrl);
                              } else {
                                setLoadingImage(true);
                                try {
                                  const fallback = await fetchFallbackImage(item.barcode || String(item.gtin));
                                  setDetailImage(fallback);
                                } finally {
                                  setLoadingImage(false);
                                }
                              }
                            }}
                            style={styles.detailsBtn}
                          >
                            <Typography variant="caption" weight="bold" color={Colors.textSecondary}>
                              Ver Detalhes
                            </Typography>
                          </TouchableOpacity>
                        </View>
                      </View>
                      {isSelected && (
                        <View style={styles.qtyStepper}>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              changeItemQuantity(item, -1);
                            }}
                          >
                            <Ionicons name="remove" size={16} color={Colors.primary} />
                          </TouchableOpacity>
                          <Typography variant="body" weight="bold" color={Colors.textPrimary} style={styles.qtyValue}>
                            {qty}
                          </Typography>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              changeItemQuantity(item, 1);
                            }}
                          >
                            <Ionicons name="add" size={16} color={Colors.primary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          );
        })()}

        {!searching && name.trim().length >= 3 && results.length === 0 && (
          <View style={styles.noResultContainer}>
            <Ionicons name="search-outline" size={36} color={Colors.textMuted} />
            <Typography variant="body" color={Colors.textMuted} style={styles.noResultText}>
              {`Nenhum produto encontrado para "${name}"`}
            </Typography>
          </View>
        )}
      </ScrollView>

      {hasSelection && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Button
            variant="primary"
            label={`Adicionar ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}`}
            loading={saving}
            onPress={handleAddItem}
            style={styles.addButton}
          />
        </View>
      )}

      {/* Details Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>

            {selectedDetailItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailImageWrapper}>
                  {loadingImage ? (
                    <ActivityIndicator size="large" color={Colors.primary} />
                  ) : detailImage ? (
                    <Image
                      source={{ uri: detailImage }}
                      style={styles.detailImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.noImage}>
                      <Ionicons name="image-outline" size={48} color={Colors.textMuted} />
                      <Typography variant="caption" color={Colors.textMuted} style={{ marginTop: 8 }}>
                        Sem imagem disponível
                      </Typography>
                    </View>
                  )}
                </View>

                <View style={styles.detailInfo}>
                  <Typography variant="caption" weight="bold" color={Colors.primary} style={styles.detailBrand}>
                    {selectedDetailItem.brand || 'Marca não informada'}
                  </Typography>
                  <Typography variant="title" weight="heavy" color={Colors.textPrimary} style={styles.detailName}>
                    {selectedDetailItem.name || selectedDetailItem.description}
                  </Typography>

                  <Card elevated style={{ marginBottom: Spacing.md }}>
                    <Typography variant="caption" weight="bold" color={Colors.textMuted}>
                      CÓDIGO DE BARRAS
                    </Typography>
                    <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                      {selectedDetailItem.barcode || selectedDetailItem.gtin}
                    </Typography>
                  </Card>

                  <View style={styles.detailSection}>
                    <Typography variant="caption" weight="bold" color={Colors.textMuted}>
                      CATEGORIA
                    </Typography>
                    <Typography variant="body" color={Colors.textPrimary}>
                      {selectedDetailItem.category || 'Outros'}
                    </Typography>
                  </View>

                  {selectedDetailItem.quantity && (
                    <View style={styles.detailSection}>
                      <Typography variant="caption" weight="bold" color={Colors.textMuted}>
                        QUANTIDADE / TAMANHO
                      </Typography>
                      <Typography variant="body" color={Colors.textPrimary}>
                        {selectedDetailItem.quantity}
                      </Typography>
                    </View>
                  )}
                </View>

                <Button
                  variant="primary"
                  label={selectedItems.some((i) => itemKey(i) === itemKey(selectedDetailItem))
                    ? 'Remover da seleção'
                    : 'Selecionar este produto'}
                  onPress={() => {
                    toggleSelection(selectedDetailItem);
                    setShowModal(false);
                  }}
                  style={styles.modalAddBtn}
                />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Location permission modal */}
      <Modal
        visible={locationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationModal(false)}
      >
        <View style={styles.locModalOverlay}>
          <View style={styles.locModalCard}>
            <View style={styles.locModalIconBg}>
              <Ionicons name="location" size={32} color={Colors.primary} />
            </View>
            <Typography variant="title" weight="bold" color={Colors.textPrimary} style={styles.locModalTitle}>
              Filtrar por Região
            </Typography>
            <Typography variant="body" color={Colors.textSecondary} style={styles.locModalDesc}>
              Permita o acesso à sua localização para que a IA possa priorizar marcas e produtos mais comuns na sua região.
            </Typography>
            <Button
              variant="primary"
              label="Permitir Localização"
              leftIcon={<Ionicons name="location-outline" size={18} color="#080A09" />}
              onPress={handleRequestLocation}
              style={{ width: '100%', marginBottom: Spacing.sm }}
            />
            <Button
              variant="ghost"
              label="Agora não"
              onPress={() => setLocationModal(false)}
              style={styles.locModalSkip}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: STATUS_BAR_HEIGHT + Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: Colors.border,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '600',
    height: '100%',
    backgroundColor: 'transparent',
  },
  filtersWrapper: {
    paddingBottom: Spacing.lg,
  },
  filtersScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  resultsScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 24,
  },
  resultsContainer: {
    gap: Spacing.sm,
  },
  resultsTitle: {
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  filterEmptyText: {
    lineHeight: 20,
  },
  resultItem: {
    borderColor: Colors.border,
    borderWidth: 1,
    padding: 0,
  },
  resultItemActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceElevated,
  },
  resultPressable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  resultThumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  resultThumbImg: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(183, 255, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultBrand: {
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailsBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 2,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    minWidth: 24,
    textAlign: 'center',
  },
  noResultContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxxl,
  },
  noResultText: {
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  addButton: {
    width: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailImageWrapper: {
    width: '100%',
    height: 200,
    backgroundColor: '#fff',
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailImage: {
    width: '90%',
    height: '90%',
  },
  noImage: {
    alignItems: 'center',
  },
  detailInfo: {
    marginBottom: Spacing.lg,
  },
  detailBrand: {
    marginBottom: Spacing.xs,
  },
  detailName: {
    marginBottom: Spacing.lg,
  },
  detailSection: {
    marginBottom: Spacing.md,
  },
  modalAddBtn: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  locModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  locModalCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locModalIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(183, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  locModalTitle: {
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  locModalDesc: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  locModalSkip: {
    alignSelf: 'center',
  },
});
