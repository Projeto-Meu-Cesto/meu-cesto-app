import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
} from 'react-native';

const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';

export default function LucaScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Insights</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.lucaHeader}>
            <View style={styles.lucaIconBg}>
                <Ionicons name="cart" size={40} color={PRIMARY_GREEN} />
            </View>
            <Text style={styles.lucaGreeting}>Olá, eu sou o LUCA</Text>
            <Text style={styles.lucaSubtitle}>Dicas personalizadas para você</Text>
        </View>

        <View style={styles.cardsContainer}>
            <InsightCard 
                icon="warning" 
                color="#EF4444" 
                title="Gastos com mercado subiram" 
                desc="Alimentação subiu 22% este mês. Veja o que está pesando mais." 
            />
            <InsightCard 
                icon="cart" 
                color={PRIMARY_GREEN} 
                title="Compras frequentes repetidas" 
                desc="Iogurte comprado 6x. Comprar em quantidade economiza R$ 12." 
            />
            <InsightCard 
                icon="time" 
                color="#F59E0B" 
                title="Meta de economia próxima" 
                desc="Você está a R$ 50 de bater sua meta. Continue assim!" 
            />
        </View>

        <TouchableOpacity style={styles.pdfButton}>
            <Text style={styles.pdfButtonText}>Gerar relatório PDF</Text>
        </TouchableOpacity>

      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput 
            style={styles.chatInput} 
            placeholder="Envie uma mensagem..."
            placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity style={styles.sendButton}>
            <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InsightCard({ icon, color, title, desc }: any) {
  return (
    <View style={styles.insightCard}>
      <View style={[styles.insightIconWrapper, { backgroundColor: color + '10' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.insightContent}>
        <Text style={styles.insightTitle}>{title}</Text>
        <Text style={styles.insightDesc}>{desc}</Text>
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
    paddingBottom: 15,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 10 : 0,
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
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 120,
  },
  lucaHeader: {
    alignItems: 'center',
    marginBottom: 35,
  },
  lucaIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  lucaGreeting: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_DARK,
    marginBottom: 5,
  },
  lucaSubtitle: {
    fontSize: 14,
    color: TEXT_GRAY,
    fontWeight: '500',
  },
  cardsContainer: {
    gap: 15,
    marginBottom: 30,
  },
  insightCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  insightIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_DARK,
    marginBottom: 5,
  },
  insightDesc: {
    fontSize: 13,
    color: TEXT_GRAY,
    lineHeight: 18,
    fontWeight: '500',
  },
  pdfButton: {
    backgroundColor: PRIMARY_GREEN,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  pdfButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  inputContainer: {
    position: 'absolute',
    bottom: 30,
    left: 25,
    right: 25,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingHorizontal: 20,
    height: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT_DARK,
    fontWeight: '500',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
