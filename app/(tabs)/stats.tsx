import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
} from 'react-native';

const { width } = Dimensions.get('window');
const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';

export default function StatsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Visão Geral</Text>
            <TouchableOpacity style={styles.notificationCircle}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerDate}>Abril 2025</Text>

          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total do mês</Text>
            <Text style={styles.totalValue}>R$ 890,00</Text>
            <Text style={styles.totalSubtitle}>+12% vs mês anterior</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <Text style={styles.sectionTitle}>EVOLUÇÃO MENSAL</Text>
        <View style={styles.chartCard}>
            <View style={styles.chartRow}>
                <Bar height={60} label="Nov" />
                <Bar height={75} label="Dez" />
                <Bar height={50} label="Jan" />
                <Bar height={85} label="Fev" />
                <Bar height={70} label="Mar" />
                <Bar height={100} label="Abr" active />
            </View>
        </View>

        <Text style={styles.sectionTitle}>POR CATEGORIA</Text>
        <View style={styles.categoriesGrid}>
            <ProgressCard label="Alimentação" value="R$ 350" progress={0.7} color="#00A36C" />
            <ProgressCard label="Transporte" value="R$ 160" progress={0.4} color="#00A36C" />
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
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 10 : 0,
    marginBottom: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  headerDate: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  notificationCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
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
    paddingBottom: 40,
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
    width: 25,
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
    marginBottom: 15,
  },
  miniCard: {
    width: (width - 65) / 2,
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
  },
  fullCardValue: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_DARK,
    marginRight: 10,
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
});
