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
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BG_LIGHT,
  PRIMARY_GREEN,
  STATUS_BAR_HEIGHT_SM as STATUS_BAR_HEIGHT,
  TEXT_DARK,
  TEXT_GRAY,
} from '../constants/theme';
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

function normalizeProductNameTyping(value: string) {
  // Retorna como o usuário digitou, sem forçar uppercase
  return value;
}

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

  // Carrega localização ao montar
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
        'Não foi possível acessar a localização. Caso o acesso tenha sido negado no dispositivo, você pode habilitá-lo nas configurações do celular.',
        [
          { text: 'Agora não', style: 'cancel' },
          { text: 'Abrir Configurações', onPress: () => Linking.openSettings() }
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
          showToast('Busca temporariamente indisponível. Tente de novo ou adicione manualmente.', 'info');
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
  }, [name, userLocation]); // ← userLocation adicionado (bug fix)

  const getItemQuantity = useCallback(
    (item: Product) => itemQuantities[itemKey(item)] ?? 1,
    [itemQuantities]
  );

  const changeItemQuantity = useCallback((item: Product, delta: number) => {
    const key = itemKey(item);
    setItemQuantities((prev) => {
      const next = Math.min(99, Math.max(1, (prev[key] ?? 1) + delta));
      return { ...prev, [key]: next };
    });
  }, []);

  const toggleSelection = (item: Product) => {
    const key = itemKey(item);
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
        const itemName = normalizeProductNameTyping(item.name || item.description);
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
    <View style={styles.container} >
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_GREEN} translucent />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Adicionar item</Text>
            <TouchableOpacity
              style={styles.locationBadge}
              onPress={() => setLocationModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.85)" />
              {locationLoading ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" style={{ marginLeft: 4 }} />
              ) : (
                <Text style={styles.locationBadgeText}>
                  {userLocation ? formatLocationLabel(userLocation) : 'Definir localização'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.inputWrapper}>
          <Ionicons name="cart-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Nome do produto"
            value={name}
            onChangeText={(value) => setName(normalizeProductNameTyping(value))}
            placeholderTextColor="#94A3B8"
            autoFocus
            autoCapitalize="sentences"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching && (
            <ActivityIndicator size="small" color={PRIMARY_GREEN} style={{ marginLeft: 8 }} />
          )}
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
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
        {/* Lista de resultados */}
        {!searching && results.length > 0 && (() => {
          const filtered = results.filter((item) => {
            if (activeFilter === 'Tudo') return true;
            return item.category === activeFilter;
          });

          return (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsTitle}>RESULTADOS ENCONTRADOS</Text>
              {filtered.length === 0 ? (
                <Text style={styles.filterEmptyText}>
                  Nenhum resultado em &quot;{activeFilter}&quot;. Troque o filtro ou refine a busca.
                </Text>
              ) : null}
              {filtered.map((item) => {
                const key = itemKey(item);
                const isSelected = selectedItems.some((i) => itemKey(i) === key);
                const imageUrl = getProductImageUrl(item);
                const qty = getItemQuantity(item);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.resultItem, isSelected && styles.resultItemActive]}
                    onPress={() => toggleSelection(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.resultLeft}>
                      {/* Thumbnail do produto */}
                      <View style={styles.resultThumb}>
                        {hasProductImage(item) ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={styles.resultThumbImg}
                            resizeMode="contain"
                          />
                        ) : (
                          <Ionicons name="cube-outline" size={22} color="#CBD5E1" />
                        )}
                        {isSelected && (
                          <View style={styles.selectedOverlay}>
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultBrand}>{item.brand || 'Marca n/i'}</Text>
                        <Text style={styles.resultName} numberOfLines={2}>{item.name || item.description}</Text>
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
                          <Text style={styles.detailsBtnText}>Ver Detalhes</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    {isSelected ? (
                      <View style={styles.qtyStepper}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            changeItemQuantity(item, -1);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="remove" size={18} color={PRIMARY_GREEN} />
                        </TouchableOpacity>
                        <Text style={styles.qtyValue}>{qty}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            changeItemQuantity(item, 1);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="add" size={18} color={PRIMARY_GREEN} />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })()}


        {/* Nenhum resultado */}
        {!searching && name.trim().length >= 3 && results.length === 0 && (
          <View style={styles.noResultContainer}>
            <Ionicons name="search-outline" size={36} color="#CBD5E1" />
            <Text style={styles.noResultText}>
              Nenhum produto encontrado{"\n"}para {name}
            </Text>
          </View>
        )}

      </ScrollView>

      {hasSelection && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddItem}
            disabled={searching || saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>
                {`Adicionar ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}`}
              </Text>
            )}
          </TouchableOpacity>
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
              <Ionicons name="close" size={24} color={TEXT_DARK} />
            </TouchableOpacity>

            {selectedDetailItem && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.detailImageWrapper}>
                  {loadingImage ? (
                    <ActivityIndicator size="large" color={PRIMARY_GREEN} />
                  ) : detailImage ? (
                    <Image
                      source={{ uri: detailImage }}
                      style={styles.detailImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.noImage}>
                      <Ionicons name="image-outline" size={60} color="#E2E8F0" />
                      <Text style={{ color: '#CBD5E1', fontSize: 12, marginTop: 8, fontWeight: '600' }}>
                        Sem imagem disponível
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.detailInfo}>
                  <Text style={styles.detailBrand}>{selectedDetailItem.brand || 'Marca não informada'}</Text>
                  <Text style={styles.detailName}>{selectedDetailItem.name || selectedDetailItem.description}</Text>

                  <View style={[styles.infoBox, { marginBottom: 20 }]}>
                    <Text style={styles.infoLabel}>Código de Barras</Text>
                    <Text style={styles.infoValue}>{selectedDetailItem.barcode || selectedDetailItem.gtin}</Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionLabel}>Categoria</Text>
                    <Text style={styles.sectionValue}>
                      {selectedDetailItem.category || 'Outros'}
                    </Text>
                  </View>

                  {selectedDetailItem.quantity ? (
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionLabel}>Quantidade / Tamanho</Text>
                      <Text style={styles.sectionValue}>{selectedDetailItem.quantity}</Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.modalAddBtn}
                  onPress={() => {
                    toggleSelection(selectedDetailItem);
                    setShowModal(false);
                  }}
                >
                  <Text style={styles.modalAddBtnText}>
                    {selectedItems.some((i) => itemKey(i) === itemKey(selectedDetailItem))
                      ? 'Remover da seleção'
                      : 'Selecionar este produto'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de permissão de localização */}
      <Modal
        visible={locationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationModal(false)}
      >
        <View style={styles.locModalOverlay}>
          <View style={styles.locModalCard}>
            <View style={styles.locModalIconBg}>
              <Ionicons name="location" size={36} color={PRIMARY_GREEN} />
            </View>
            <Text style={styles.locModalTitle}>Filtrar por Região</Text>
            <Text style={styles.locModalDesc}>
              Permita o acesso à sua localização para que a IA possa priorizar marcas e produtos mais comuns na sua região.
            </Text>
            <TouchableOpacity
              style={styles.locModalBtn}
              onPress={handleRequestLocation}
              activeOpacity={0.85}
            >
              <Ionicons name="location-outline" size={18} color="#fff" />
              <Text style={styles.locModalBtnText}>Permitir Localização</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.locModalSkip}
              onPress={() => setLocationModal(false)}
            >
              <Text style={styles.locModalSkipText}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: TEXT_DARK,
    fontWeight: '600',
    height: '100%',
    borderWidth: 0,
    backgroundColor: 'transparent',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        boxShadow: 'none',
      } as any,
    }),
  },
  filtersWrapper: {
    backgroundColor: PRIMARY_GREEN,
    paddingBottom: 25,
    marginTop: -2,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  filtersScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterChipActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  filterTextActive: {
    color: PRIMARY_GREEN,
  },
  resultsScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  qtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_DARK,
    marginHorizontal: 4,
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loaderText: {
    marginTop: 12,
    color: TEXT_GRAY,
    fontSize: 14,
    fontWeight: '600',
  },
  noResultContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noResultText: {
    marginTop: 12,
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  resultsContainer: {
    marginBottom: 30,
  },
  resultsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 15,
  },
  filterEmptyText: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontWeight: '600',
    marginBottom: 16,
    lineHeight: 20,
  },
  resultItem: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  resultItemActive: {
    borderColor: PRIMARY_GREEN,
    backgroundColor: '#F0FDF4',
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  resultBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: PRIMARY_GREEN,
    textTransform: 'uppercase',
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_DARK,
    width: '85%',
  },
  addButton: {
    backgroundColor: PRIMARY_GREEN,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  detailsBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  detailsBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_GRAY,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 25,
    maxHeight: '85%',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailImageWrapper: {
    width: '100%',
    height: 200,
    backgroundColor: '#fff',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailImage: {
    width: '80%',
    height: '80%',
  },
  noImage: {
    alignItems: 'center',
  },
  detailInfo: {
    marginBottom: 25,
  },
  detailBrand: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY_GREEN,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailName: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_DARK,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  infoBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: TEXT_GRAY,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  detailSection: {
    marginBottom: 15,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_GRAY,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_DARK,
    lineHeight: 20,
  },
  modalAddBtn: {
    backgroundColor: PRIMARY_GREEN,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  modalAddBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  // Location badge no header
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  locationBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  // Thumbnail no card de resultado
  resultThumb: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    backgroundColor: PRIMARY_GREEN + 'CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal de permissão de localização
  locModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  locModalCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  locModalIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  locModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: TEXT_DARK,
    marginBottom: 12,
    textAlign: 'center',
  },
  locModalDesc: {
    fontSize: 14,
    color: TEXT_GRAY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  locModalBtn: {
    backgroundColor: PRIMARY_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
    width: '100%',
    marginBottom: 12,
  },
  locModalBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  locModalSkip: {
    paddingVertical: 8,
  },
  locModalSkipText: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontWeight: '600',
  },
});
