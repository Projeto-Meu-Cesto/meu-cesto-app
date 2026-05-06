import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY_GREEN = '#00C853';
const TEXT_GRAY = '#757575';
const BORDER_GRAY = '#F0F0F0';

export default function InsightsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={PRIMARY_GREEN} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Voltar</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Insights</Text>
          <Text style={styles.subtitle}>Dicas personalizadas para você</Text>
        </View>

        <InsightCard 
          icon="alert-circle-outline" 
          title="Gastos com mercado subiram" 
          description="Você gastou 32% a mais em alimentação este mês. Considere planejar sua lista antes de ir ao mercado." 
          color="#D32F2F"
        />

        <InsightCard 
          icon="sync-outline" 
          title="Compras frequentes repetidas" 
          description="Você comprou iogurte 8 vezes este mês. Comprar em quantidade maior pode economizar até R$ 15,00." 
          color="#1976D2"
        />

        <InsightCard 
          icon="stats-chart-outline" 
          title="Meta de economia próxima" 
          description="Você está a R$ 5,40 de bater sua meta mensal. Continue assim!" 
          color="#388E3C"
        />

        <TouchableOpacity style={styles.pdfButton}>
          <Text style={styles.pdfButtonText}>Gerar relatório PDF</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function InsightCard({ icon, title, description, color }: any) {
  return (
    <View style={[styles.insightCard, { borderColor: color }]}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon} size={22} color={color} />
        <Text style={[styles.cardTitle, { color: color }]}>{title}</Text>
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 16,
    color: PRIMARY_GREEN,
    fontWeight: '700',
    marginLeft: 5,
  },
  scrollContent: {
    paddingHorizontal: 30,
    paddingBottom: 40,
  },
  titleContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 15,
    color: TEXT_GRAY,
  },
  insightCard: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 10,
  },
  cardDescription: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    paddingLeft: 32,
  },
  pdfButton: {
    backgroundColor: '#444',
    height: 55,
    borderRadius: 27.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  pdfButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
