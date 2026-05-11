import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 24)
  : 54;
const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';

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
  }, []);
  return (
    <Animated.View
      style={[{ width: w, height: h, backgroundColor: '#E2E8F0', borderRadius: 10, opacity }, style]}
    />
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const [loading] = React.useState(false); // troque para true para ver skeleton

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_GREEN} translucent />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ width: 44 }} />
          <Text style={styles.headerTitle}>Finanças</Text>
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerDate}>Maio 2025</Text>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total do mês</Text>
          <Text style={styles.totalValue}>R$ 890,00</Text>
          <Text style={styles.totalSubtitle}>+12% vs mês anterior</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {loading ? (
          // Skeleton state
          <>
            <SkeletonBox width="40%" height={12} style={{ marginBottom: 15, borderRadius: 6 }} />
            <SkeletonBox width="100%" height={180} style={{ marginBottom: 30, borderRadius: 24 }} />
            <SkeletonBox width="40%" height={12} style={{ marginBottom: 15, borderRadius: 6 }} />
            <View style={{ flexDirection: 'row', gap: 15, marginBottom: 15 }}>
              <SkeletonBox width={(width - 65) / 2} height={90} style={{ borderRadius: 20 }} />
              <SkeletonBox width={(width - 65) / 2} height={90} style={{ borderRadius: 20 }} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>EVOLUÇÃO MENSAL</Text>
            <View style={styles.chartCard}>
              <View style={styles.chartRow}>
                <Bar height={60} label="Nov" />
                <Bar height={75} label="Dez" />
                <Bar height={50} label="Jan" />
                <Bar height={85} label="Fev" />
                <Bar height={70} label="Mar" />
                <Bar height={100} label="Mai" active />
              </View>
            </View>

            <Text style={styles.sectionTitle}>POR CATEGORIA</Text>
            <View style={styles.categoriesGrid}>
              <ProgressCard label="Alimentação" value="R$ 350" progress={0.7} color={PRIMARY_GREEN} />
              <ProgressCard label="Transporte" value="R$ 160" progress={0.4} color={PRIMARY_GREEN} />
            </View>

            <View style={styles.fullProgressCard}>
              <View style={styles.fullCardHeader}>
                <Text style={styles.fullCardLabel}>Outros</Text>
                <View style={styles.fullCardValueRow}>
                  <Text style={styles.fullCardValue}>R$ 220</Text>
                  <Text style={styles.fullCardPercent}>25%</Text>
                </View>
              </View>
              <View style={styles.fullProgressBarBg}>
                <View style={[styles.fullProgressBarFill, { width: '25%' }]} />
              </View>
            </View>

            {/* Botão Falar com Luca */}
            <TouchableOpacity style={styles.lucaBtn} onPress={() => router.push('/luca')}>
              <View style={styles.lucaBtnLeft}>
                <View style={styles.lucaIconBg}>
                  <Ionicons name="sparkles" size={20} color={PRIMARY_GREEN} />
                </View>
                <View>
                  <Text style={styles.lucaBtnTitle}>Falar com Luca</Text>
                  <Text style={styles.lucaBtnSub}>Análise inteligente dos seus gastos</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={PRIMARY_GREEN} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Bar({ height, label, active }: any) {
  return (
    <View style={styles.barWrapper}>
      <View style={[styles.bar, { height: `${height}%`, backgroundColor: active ? PRIMARY_GREEN : '#94E2C6' }]} />
      <Text style={styles.barLabel}>{label}</Text>
    </View>
  );
}

function ProgressCard({ label, value, progress, color }: any) {
  return (
    <View style={styles.miniCard}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>{value}</Text>
      <View style={styles.miniBarBg}>
        <View style={[styles.miniBarFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
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
    paddingHorizontal: 25,
    paddingTop: STATUS_BAR_HEIGHT,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 5,
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
  headerDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  totalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  totalLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 5,
  },
  totalValue: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 5,
  },
  totalSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 25,
    paddingBottom: 120,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 15,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    height: 180,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  chartRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barWrapper: {
    alignItems: 'center',
    width: (width - 130) / 6,
  },
  bar: {
    width: 24,
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '700',
    marginTop: 10,
  },
  categoriesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    marginBottom: 15,
  },
  miniCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  miniLabel: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontWeight: '600',
    marginBottom: 4,
  },
  miniValue: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_DARK,
    marginBottom: 12,
  },
  miniBarBg: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
  },
  miniBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  fullProgressCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
  },
  fullCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  fullCardLabel: {
    fontSize: 13,
    color: TEXT_GRAY,
    fontWeight: '600',
  },
  fullCardValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullCardValue: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  fullCardPercent: {
    fontSize: 14,
    fontWeight: '800',
    color: PRIMARY_GREEN,
  },
  fullProgressBarBg: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
  },
  fullProgressBarFill: {
    height: '100%',
    backgroundColor: '#A7F3D0',
    borderRadius: 4,
  },
  lucaBtn: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D1FAE5',
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  lucaBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  lucaIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lucaBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_DARK,
  },
  lucaBtnSub: {
    fontSize: 12,
    color: TEXT_GRAY,
    fontWeight: '500',
    marginTop: 2,
  },
});
