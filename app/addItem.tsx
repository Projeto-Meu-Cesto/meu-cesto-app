import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { categorizeProductLocal } from '../scripts/aiService';
import { CosmosProduct, fetchFallbackImage, fetchProductsByName } from '../scripts/cosmosService';
import { auth, db } from '../scripts/firebaseConfig';

const { height } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24)
  : 44; // iOS safe area top (cobre notch e Dynamic Island)

const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';
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

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizePriceTyping(value: string) {
  const clean = value.replace(/[^\d,.]/g, '').replace(/\./g, ',');
  const [whole, ...decimalParts] = clean.split(',');

  if (decimalParts.length === 0) {
    return whole;
  }

  return `${whole},${decimalParts.join('').slice(0, 2)}`;
}

function normalizePriceForStorage(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed.toFixed(2).replace('.', ',')
    : '';
}

function normalizeQuantityTyping(value: string) {
  return value.replace(/[^\d]/g, '').slice(0, 3);
}

function normalizeProductNameTyping(value: string) {
  return value.toLocaleUpperCase('pt-BR');
}

function parseQuantity(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default function AddItemScreen() {
  const [name, setName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CosmosProduct[]>([]);
  const [selectedItems, setSelectedItems] = useState<CosmosProduct[]>([]);
  const [activeFilter, setActiveFilter] = useState('Tudo');
  const [selectedDetailItem, setSelectedDetailItem] = useState<CosmosProduct | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [detailImage, setDetailImage] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const filters = ['Tudo', 'Frutas', 'Laticínios', 'Limpeza', 'Higiene', 'Bebidas', 'Padaria', 'Carnes'];
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const user = auth.currentUser;

  // Busca automática com debounce de 600ms
  useEffect(() => {
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

        // Ordenação inteligente: termo exato primeiro, depois os que começam com o termo
        const sorted = (data || []).sort((a, b) => {
          const aDesc = a.description.toLowerCase();
          const bDesc = b.description.toLowerCase();
          const query = searchTerm.toLowerCase();

          if (aDesc === query && bDesc !== query) return -1;
          if (bDesc === query && aDesc !== query) return 1;

          const aStarts = aDesc.startsWith(query);
          const bStarts = bDesc.startsWith(query);
          if (aStarts && !bStarts) return -1;
          if (bStarts && !aStarts) return 1;

          return 0;
        });

        setResults(sorted);
      } catch {
        console.warn('[Cosmos] Busca indisponível. Você ainda pode adicionar manualmente.');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name]);

  const toggleSelection = (item: CosmosProduct) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.gtin === item.gtin);
      if (exists) {
        return prev.filter(i => i.gtin !== item.gtin);
      }
      return [...prev, item];
    });
  };

  const handleAddItem = async () => {
    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado.');
      return;
    }

    if (saving) return;

    setSaving(true);
    try {
      const payloads: ItemPayload[] = [];

      if (selectedItems.length > 0) {
        selectedItems.forEach((item) => {
          const itemName = normalizeProductNameTyping(item.description);
          const itemToAdd = {
            name: itemName,
            price: item.avg_price?.toString() || '',
            quantity: 1,
            brand: item.brand?.name || '',
            thumbnail: item.thumbnail || ''
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
      } else {
        if (!name.trim()) {
          Alert.alert('Aviso', 'Digite o nome do produto ou selecione na lista.');
          setSaving(false);
          return;
        }

        const cleanName = normalizeProductNameTyping(name.trim());
        const cleanPrice = normalizePriceForStorage(manualPrice);
        const cleanQuantity = parseQuantity(quantity);
        const category = categorizeProductLocal(cleanName);

        payloads.push({
          name: cleanName,
          price: cleanPrice,
          quantity: cleanQuantity,
          brand: '',
          thumbnail: '',
          checked: false,
          category: category,
          createdAt: Timestamp.now(),
          checkedAt: null,
        });
      }

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
        Alert.alert(
          'Erro ao salvar',
          'Não foi possível adicionar agora. Verifique sua conexão e tente novamente.'
        );
        return;
      }

      if (result === 'pending') {
        saveResult.then((finalResult) => {
          if (finalResult === 'failed') {
            console.warn('[Lista] A gravação em segundo plano falhou.');
          }
        });
      }

      setName('');
      setManualPrice('');
      setQuantity('1');
      setSelectedItems([]);
      router.replace('/lists');
    } catch {
      Alert.alert(
        'Erro ao salvar',
        'Não foi possível adicionar agora. Verifique sua conexão e se o Firebase está liberado para sua conta.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_GREEN} translucent />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Adicionar item</Text>
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
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching && (
            <ActivityIndicator size="small" color={PRIMARY_GREEN} style={{ marginLeft: 8 }} />
          )}
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.inputWrapper, styles.priceInputWrapper, styles.priceInput]}>
            <Ionicons name="cash-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Preço. Ex: 4,99"
              value={manualPrice}
              onChangeText={(value) => setManualPrice(normalizePriceTyping(value))}
              placeholderTextColor="#94A3B8"
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>

          <View style={[styles.inputWrapper, styles.priceInputWrapper, styles.quantityInput]}>
            <Ionicons name="layers-outline" size={20} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Qtd."
              value={quantity}
              onChangeText={(value) => setQuantity(normalizeQuantityTyping(value))}
              placeholderTextColor="#94A3B8"
              keyboardType="number-pad"
              returnKeyType="done"
            />
          </View>
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loader de pesquisa */}
        {searching && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={PRIMARY_GREEN} />
            <Text style={styles.loaderText}>Pesquisando produto...</Text>
          </View>
        )}

        {/* Lista de resultados */}
        {!searching && results.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>RESULTADOS ENCONTRADOS</Text>
            {results
              .filter(item => {
                if (activeFilter === 'Tudo') return true;
                const desc = item.description.toLowerCase();
                const filter = activeFilter.toLowerCase();

                const filterKeywords: { [key: string]: string[] } = {
                  'frutas': ['fruta', 'banana', 'maçã', 'uva', 'morango', 'laranja', 'limão', 'abacaxi', 'mamão', 'melancia'],
                  'laticínios': ['leite', 'queijo', 'iogurte', 'manteiga', 'creme', 'requeijão', 'danone', 'coalhada'],
                  'limpeza': ['detergente', 'sabão', 'amaciante', 'limpador', 'desinfetante', 'esponja', 'cloro', 'água sanitária'],
                  'higiene': ['shampoo', 'sabonete', 'pasta', 'escova', 'desodorante', 'papel', 'absorvente', 'fio dental'],
                  'bebidas': ['água', 'suco', 'refrigerante', 'cerveja', 'vinho', 'café', 'chá', 'energético', 'vodka'],
                  'padaria': ['pão', 'bolo', 'biscoito', 'bolacha', 'rosca', 'baguete', 'croissant'],
                  'carnes': ['carne', 'frango', 'peixe', 'linguiça', 'presunto', 'salame', 'bife', 'costela'],
                };

                return filterKeywords[filter]?.some(kw => desc.includes(kw)) ?? true;
              })
              .map((item, index) => {
                const isSelected = selectedItems.some(i => i.gtin === item.gtin);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.resultItem, isSelected && styles.resultItemActive]}
                    onPress={() => toggleSelection(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.resultLeft}>
                      <View style={[styles.statusDot, { backgroundColor: isSelected ? PRIMARY_GREEN : '#E2E8F0' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultBrand}>{item.brand?.name || 'Marca n/i'}</Text>
                        <Text style={styles.resultName} numberOfLines={2}>{item.description}</Text>
                        <TouchableOpacity
                          onPress={async (e) => {
                            e.stopPropagation();
                            setSelectedDetailItem(item);
                            setShowModal(true);
                            // Resolve imagem: Cosmos primeiro, depois Open Food Facts
                            setDetailImage(null);
                            if (item.thumbnail) {
                              setDetailImage(item.thumbnail);
                            } else {
                              setLoadingImage(true);
                              try {
                                const fallback = await fetchFallbackImage(item.gtin);
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
                    <Text style={styles.resultPrice}>
                      {item.avg_price ? `R$ ${item.avg_price.toFixed(2)}` : '--'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
        )}


        {/* Nenhum resultado */}
        {!searching && name.trim().length >= 3 && results.length === 0 && (
          <View style={styles.noResultContainer}>
            <Ionicons name="search-outline" size={36} color="#CBD5E1" />
            <Text style={styles.noResultText}>
              Nenhum produto encontrado{"\n"}para {name}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.addButton, (!name.trim() && selectedItems.length === 0) && { opacity: 0.5 }]}
          onPress={handleAddItem}
          disabled={(!name.trim() && selectedItems.length === 0) || searching || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.addButtonText}>
              {selectedItems.length > 0
                ? `Adicionar ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}`
                : 'Adicionar à lista'
              }
            </Text>
          )}
        </TouchableOpacity>

      </ScrollView>

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
                  <Text style={styles.detailBrand}>{selectedDetailItem.brand?.name || 'Marca não informada'}</Text>
                  <Text style={styles.detailName}>{selectedDetailItem.description}</Text>

                  <View style={styles.infoRow}>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>GTIN / EAN</Text>
                      <Text style={styles.infoValue}>{selectedDetailItem.gtin}</Text>
                    </View>
                    <View style={styles.infoBox}>
                      <Text style={styles.infoLabel}>Preço Médio</Text>
                      <Text style={[styles.infoValue, { color: PRIMARY_GREEN }]}>
                        {selectedDetailItem.avg_price ? `R$ ${selectedDetailItem.avg_price.toFixed(2)}` : 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionLabel}>Categoria GPC</Text>
                    <Text style={styles.sectionValue}>
                      {selectedDetailItem.gpc?.description || 'Não categorizado'}
                    </Text>
                  </View>

                  <View style={styles.detailSection}>
                    <Text style={styles.sectionLabel}>NCM</Text>
                    <Text style={styles.sectionValue}>
                      {selectedDetailItem.ncm?.code} - {selectedDetailItem.ncm?.description}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalAddBtn}
                  onPress={() => {
                    toggleSelection(selectedDetailItem);
                    setShowModal(false);
                  }}
                >
                  <Text style={styles.modalAddBtnText}>
                    {selectedItems.some(i => i.gtin === selectedDetailItem.gtin)
                      ? 'Remover da seleção'
                      : 'Selecionar este produto'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  priceInputWrapper: {
    marginTop: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priceInput: {
    flex: 1,
  },
  quantityInput: {
    width: 118,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 50,
    minHeight: height * 0.6,
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
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
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
  resultPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_GRAY,
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
    marginTop: 10,
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
});
