import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { auth, db } from '../scripts/firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';

export default function AddItemScreen() {
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const router = useRouter();
  const user = auth.currentUser;

  const handleAddItem = async () => {
    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado.');
      return;
    }

    if (!selectedItem) {
      Alert.alert('Aviso', 'Selecione um item primeiro.');
      return;
    }

    try {
      await addDoc(collection(db, 'users', user.uid, 'shopping_list'), {
        name: selectedItem.name,
        price: selectedItem.price,
        checked: false,
        category: 'Outros', // Pode ser expandido futuramente
        createdAt: serverTimestamp(),
      });
      router.back();
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o item.');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Adicionar item</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
                style={styles.searchInput}
                placeholder="logurte"
                value={search}
                onChangeText={setSearch}
                placeholderTextColor="#94A3B8"
            />
          </View>
        </SafeAreaView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.sectionTitle}>COMÉRCIO LOCAL</Text>
        <View style={styles.resultCard}>
            <PriceRow 
              name="Iogurte Natural 170g" 
              price="R$ 3,49" 
              color="#00A36C" 
              active={selectedItem?.name === "Iogurte Natural 170g"}
              onPress={() => setSelectedItem({ name: "Iogurte Natural 170g", price: "3,49" })}
            />
            <PriceRow 
              name="Iogurte Grego 100g" 
              price="R$ 4,20" 
              color="#00A36C" 
              active={selectedItem?.name === "Iogurte Grego 100g"}
              onPress={() => setSelectedItem({ name: "Iogurte Grego 100g", price: "4,20" })}
            />
        </View>

        <Text style={styles.sectionTitle}>VAREJO DIGITAL</Text>
        <View style={styles.resultCard}>
            <PriceRow 
              name="Pack 6 unidades" 
              price="R$ 15,90" 
              color="#00A36C" 
              active={selectedItem?.name === "Pack 6 unidades"}
              onPress={() => setSelectedItem({ name: "Pack 6 unidades", price: "15,90" })}
            />
        </View>

        <View style={styles.aiSuggestion}>
            <Text style={styles.aiLabel}>LUCA encontrou</Text>
            <Text style={styles.aiText}>Online está 14% mais barato. Comprar em pack economiza R$ 5,04.</Text>
        </View>

        <TouchableOpacity 
          style={[styles.addButton, !selectedItem && { opacity: 0.5 }]}
          onPress={handleAddItem}
          disabled={!selectedItem}
        >
          <Text style={styles.addButtonText}>Adicionar à lista</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

function PriceRow({ name, price, color, active, onPress }: any) {
  return (
    <TouchableOpacity 
      style={[styles.priceRow, active && styles.priceRowActive]} 
      onPress={onPress}
    >
      <View style={[styles.dot, { backgroundColor: active ? PRIMARY_GREEN : '#E2E8F0' }]} />
      <Text style={[styles.rowText, active && { color: PRIMARY_GREEN }]}>{name}</Text>
      <Text style={[styles.rowPrice, active && { color: PRIMARY_GREEN }]}>{price}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingHorizontal: 25,
    paddingBottom: 25,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 10 : 0,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 15,
    height: 52,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT_DARK,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 15,
    marginTop: 10,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 10,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
  },
  priceRowActive: {
    backgroundColor: '#F0FDF4',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    color: TEXT_DARK,
    fontWeight: '600',
  },
  rowPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_GRAY,
  },
  aiSuggestion: {
    backgroundColor: '#DCFCE7',
    padding: 20,
    borderRadius: 20,
    marginBottom: 30,
  },
  aiLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
    marginBottom: 5,
  },
  aiText: {
    fontSize: 14,
    color: '#166534',
    lineHeight: 20,
    fontWeight: '500',
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
});
