import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth, db } from '../../scripts/firebaseConfig';

const { width } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24)
  : 44;

const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';

const INITIAL_ITEMS = [
  { id: '1', name: 'Leite Integral', price: 'R$ 8,90', checked: true },
  { id: '2', name: 'Pão de forma', price: 'R$ 12,50', checked: true },
  { id: '3', name: 'Peito de Frango', price: 'R$ 27,80', checked: true },
  { id: '4', name: 'Feijão 2kg', price: 'R$ 14,90', checked: false },
  { id: '5', name: 'Arroz 5kg', price: 'R$ 18,90', checked: false },
  { id: '6', name: 'Ovos (12 un)', price: 'R$ 15,90', checked: false },
];

export default function ListsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const user = auth.currentUser;

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'shopping_list'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      setItems(list);
    });

    return () => unsub();
  }, [user]);

  const toggleItem = async (itemId: string, currentStatus: boolean) => {
    if (!user) return;
    try {
      const itemRef = doc(db, 'users', user.uid, 'shopping_list', itemId);
      await updateDoc(itemRef, { checked: !currentStatus });
    } catch (error) {
      console.error("Erro ao atualizar item:", error);
    }
  };

  const alreadyInCart = items.filter(item => item.checked);
  const stillMissing = items.filter(item => !item.checked);

  const totalEstimated = items.reduce((acc, item) => {
    const price = typeof item.price === 'string'
      ? parseFloat(item.price.replace('R$ ', '').replace(',', '.'))
      : (parseFloat(item.price) || 0);
    return acc + price;
  }, 0);

  const totalInCart = alreadyInCart.reduce((acc, item) => {
    const price = typeof item.price === 'string'
      ? parseFloat(item.price.replace('R$ ', '').replace(',', '.'))
      : (parseFloat(item.price) || 0);
    return acc + price;
  }, 0);

  const progress = items.length > 0 ? alreadyInCart.length / items.length : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_GREEN} translucent />

      <View style={styles.header}>
        <View>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Minha lista</Text>
            <TouchableOpacity style={styles.notificationCircle}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressLabel}>No carrinho</Text>
                <Text style={styles.progressAmount}>R$ {totalInCart.toFixed(2).replace('.', ',')}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.progressLabel}>Total estimado</Text>
                <Text style={styles.progressAmount}>R$ {totalEstimated.toFixed(2).replace('.', ',')}</Text>
              </View>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
            </View>
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

        {stillMissing.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>MINHA LISTA DE COMPRAS</Text>
            <View style={styles.listSection}>
              {stillMissing.map((item) => (
                <ShoppingItem
                  key={item.id}
                  name={item.name}
                  price={item.price}
                  checked={false}
                  onPress={() => toggleItem(item.id, false)}
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
                  name={item.name}
                  price={item.price}
                  checked={true}
                  onPress={() => toggleItem(item.id, true)}
                />
              ))}
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

      </ScrollView>
    </View>
  );
}

function ShoppingItem({ name, price, checked, onPress }: any) {
  return (
    <TouchableOpacity style={styles.itemRow} onPress={onPress}>
      <View style={styles.itemLeft}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
        <Text style={[styles.itemName, checked && styles.itemNameChecked]}>{name}</Text>
      </View>
      <Text style={[styles.itemPrice, checked && styles.itemPriceChecked]}>R$ {price}</Text>
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
  notificationCircle: {
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
    paddingBottom: 40,
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
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: PRIMARY_GREEN,
    borderColor: PRIMARY_GREEN,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_GRAY,
  },
  itemNameChecked: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CBD5E1',
    textDecorationLine: 'line-through',
  },
  itemPriceChecked: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E2E8F0',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 25,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 15,
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  addButton: {
    backgroundColor: PRIMARY_GREEN,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
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
});
