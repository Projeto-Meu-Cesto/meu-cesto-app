import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CosmosProduct, fetchProductsByName } from '../scripts/cosmosService';
import { auth, db } from '../scripts/firebaseConfig';

const { width, height } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24)
  : 44; // iOS safe area top (cobre notch e Dynamic Island)

const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';

export default function AddItemScreen() {
  const [name, setName] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CosmosProduct[]>([]);
  const [selectedItems, setSelectedItems] = useState<CosmosProduct[]>([]);
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
        const data = await fetchProductsByName(name.trim());
        console.log('[Cosmos] Resultados para "' + name + '":', JSON.stringify(data?.slice(0, 3)));
        setResults(data || []);
      } catch (error) {
        console.error('[Cosmos] Erro:', error);
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

    try {
      if (selectedItems.length > 0) {
        // Salva todos os itens selecionados
        for (const item of selectedItems) {
          const itemToAdd = {
            name: item.description,
            price: item.avg_price?.toString() || '',
            brand: item.brand?.name || '',
            thumbnail: item.thumbnail || ''
          };

          await addDoc(collection(db, 'users', user.uid, 'shopping_list'), {
            ...itemToAdd,
            checked: false,
            category: 'Outros',
            createdAt: serverTimestamp(),
          });
        }
      } else {
        // Se nenhum item foi selecionado, salva o texto digitado
        if (!name.trim()) {
          Alert.alert('Aviso', 'Digite o nome do produto ou selecione na lista.');
          return;
        }

        await addDoc(collection(db, 'users', user.uid, 'shopping_list'), {
          name: name,
          price: '',
          brand: '',
          thumbnail: '',
          checked: false,
          category: 'Outros',
          createdAt: serverTimestamp(),
        });
      }
      router.back();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar os itens.');
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
            placeholder="Nome do produto"
            value={name}
            onChangeText={setName}
            placeholderTextColor="#94A3B8"
            autoFocus
            returnKeyType="search"
          />
          {searching && (
            <ActivityIndicator size="small" color={PRIMARY_GREEN} style={{ marginLeft: 8 }} />
          )}
        </View>
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
            {results.map((item, index) => {
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
            <Text style={styles.noResultText}>Nenhum produto encontrado{"\n"}para "{name}"</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.addButton, (!name.trim() && selectedItems.length === 0) && { opacity: 0.5 }]}
          onPress={handleAddItem}
          disabled={(!name.trim() && selectedItems.length === 0) || searching}
          activeOpacity={0.85}
        >
          <Text style={styles.addButtonText}>
            {selectedItems.length > 0
              ? `Adicionar ${selectedItems.length} item${selectedItems.length > 1 ? 's' : ''}`
              : 'Adicionar à lista'
            }
          </Text>
        </TouchableOpacity>

      </ScrollView>
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
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
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
    fontWeight: '500',
    height: '100%',
    ...Platform.select({
      web: { outlineStyle: 'none' },
    }),
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
});
