import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
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
import Animated, { FadeInUp } from 'react-native-reanimated';
import { auth, db } from '../../scripts/firebaseConfig';

const { width } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24)
  : 44;
const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';

export default function HomeScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const [stats, setStats] = useState({
    totalSpent: '0,00',
    percentChange: '+0%',
    categories: [
      { id: '1', label: 'Alimentação', value: 'R$ 0', icon: 'cart' },
      { id: '2', label: 'Transporte', value: 'R$ 0', icon: 'bus' },
      { id: '3', label: 'Outros', value: 'R$ 0', icon: 'cube' },
    ]
  });

  const [weeklyList, setWeeklyList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Como o Firebase já é real-time via onSnapshot, o refresh manual apenas
    // simula o feedback visual de atualização que o usuário espera.
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const addProduct = (productName: string) => {
    if (productName.trim() === '') return;

    const newProduct = {
      id: Math.random().toString(),
      name: productName,
    };

    setWeeklyList([...weeklyList, newProduct]);
  };

  useEffect(() => {
    if (!user) return;


    const unsubStats = onSnapshot(doc(db, 'dashboards', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setStats(prev => ({
          ...prev,
          totalSpent: data.totalSpent || '0,00',
          percentChange: data.percentChange || '+0%',
          categories: data.categories || prev.categories,
        }));
      }
    });

    const q = query(
      collection(db, 'users', user.uid, 'shopping_list'),
      orderBy('createdAt', 'desc'),
      limit(4)
    );

    const unsubList = onSnapshot(q, (snapshot) => {
      const items: any[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      setWeeklyList(items);
      setLoading(false);
    });

    return () => {
      unsubStats();
      unsubList();
    };
  }, [user]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_GREEN} translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={PRIMARY_GREEN} // Cor do spinner (mais visível se descer para a área branca ou com fundo)
            colors={[PRIMARY_GREEN]}
            progressViewOffset={STATUS_BAR_HEIGHT + 60} // Desce mais o loader
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>Bom dia,</Text>
              <Text style={styles.userName}>{user?.displayName || 'Usuário'}</Text>
            </View>
            <TouchableOpacity style={styles.notificationCircle}>
              <Ionicons name="notifications" size={20} color="#fff" />
              <View style={styles.activeDot} />
            </TouchableOpacity>
          </View>

          <Animated.View entering={FadeInUp.delay(200)} style={styles.mainCard}>
            <Text style={styles.mainCardLabel}>Gastos do mês</Text>
            <Text style={styles.mainCardAmount}>R$ {stats.totalSpent}</Text>
            <Text style={styles.mainCardSubtitle}>{stats.percentChange} em relação ao mês passado</Text>
          </Animated.View>
        </View>

        <View style={styles.mainContent}>


          {/* Categories Row */}
          <View style={styles.categoriesRow}>
            {stats.categories.map((cat: any) => (
              <CategoryCard key={cat.id} icon={cat.icon} label={cat.label} value={cat.value} />
            ))}
          </View>

          {/* Weekly List Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>LISTA DA SEMANA</Text>
            <TouchableOpacity onPress={() => router.push('/lists')}>
              <Text style={styles.seeAll}>Ver tudo →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.listContainer}>
            {weeklyList.length > 0 ? (
              weeklyList.map((item: any) => (
                <ListItem key={item.id} name={item.name} price={item.price} color={item.color || '#CBD5E1'} />
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Ionicons name="cart-outline" size={32} color="#CBD5E1" />
                <Text style={styles.emptyText}>Nenhum item adicionado à lista.</Text>
              </View>
            )}
          </View>

        </View>

      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/addItem')}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

function CategoryCard({ icon, label, value }: any) {
  return (
    <View style={styles.catCard}>
      <View style={styles.catIconWrapper}>
        <Ionicons name={icon} size={24} color={TEXT_GRAY} />
      </View>
      <Text style={styles.catLabel}>{label}</Text>
      <Text style={styles.catValue}>{value}</Text>
    </View>
  );
}

function ListItem({ name, price, color }: any) {
  return (
    <View style={styles.listItem}>
      <View style={styles.listItemLeft}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={styles.itemName}>{name}</Text>
      </View>
      <Text style={styles.itemPrice}>{price}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  scrollContent: {
    paddingBottom: 120,
    backgroundColor: BG_LIGHT,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingHorizontal: 20,
    paddingTop: STATUS_BAR_HEIGHT + 10,
    paddingBottom: 35,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  notificationCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    backgroundColor: '#FF5252',
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: PRIMARY_GREEN,
  },
  mainCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  mainCardLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 5,
  },
  mainCardAmount: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 5,
  },
  mainCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
  },
  mainContent: {
    paddingHorizontal: 25,
    paddingTop: 25,
  },
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  catCard: {
    width: (width - 70) / 3,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  catIconWrapper: {
    marginBottom: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catLabel: {
    fontSize: 11,
    color: TEXT_GRAY,
    fontWeight: '600',
    marginBottom: 4,
  },
  catValue: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_GREEN,
  },
  listContainer: {
    gap: 12,
  },
  listItem: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_GRAY,
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
  loadingBox: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: TEXT_GRAY,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F1F5F9',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
});
