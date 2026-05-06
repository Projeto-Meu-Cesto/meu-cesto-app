import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  Layout
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const PRIMARY_GREEN = '#00C853';
const LIGHT_GREEN = '#E8F5E9';
const TEXT_GRAY = '#757575';
const BORDER_GRAY = '#E0E0E0';

const OPTIONS = [
  { id: 'save', title: 'Economizar Dinheiro', icon: 'cash-outline' },
  { id: 'organize', title: 'Organizar compras', icon: 'cart-outline' },
  { id: 'track', title: 'Rastrear Gastos', icon: 'stats-chart-outline' },
  { id: 'budget', title: 'Planejar Orçamento', icon: 'calendar-outline' },
  { id: 'ai', title: 'Analisar Preços com IA', icon: 'bulb-outline' },
  { id: 'shared', title: 'Listas Compartilhadas', icon: 'people-outline' },
];

export default function OnboardingScreen() {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const router = useRouter();

  const toggleOption = (id: string) => {
    if (selectedOptions.includes(id)) {
      setSelectedOptions(selectedOptions.filter(item => item !== id));
    } else {
      setSelectedOptions([...selectedOptions, id]);
    }
  };

  const handleFinish = () => {
    router.replace('/(tabs)/home');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View style={styles.glow} />
        <Animated.View entering={FadeInUp.delay(200).duration(800)} style={styles.headerIcons}>
          <View style={styles.iconBox}>
            <Ionicons name="cart" size={40} color={PRIMARY_GREEN} />
          </View>
          <View style={styles.iconDivider} />
          <View style={styles.iconBox}>
            <Ionicons name="card" size={40} color={PRIMARY_GREEN} />
          </View>
        </Animated.View>
      </View>

      <SafeAreaView style={styles.content}>
        <ScrollView 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View entering={FadeInDown.delay(400).duration(800)} style={styles.titleContainer}>
            <Text style={styles.title}>Controle suas compras e economize</Text>
            <Text style={styles.subtitle}>
              Organize suas listas, acompanhe seus gastos e economize todo mês com inteligência.
            </Text>
          </Animated.View>

          <View style={styles.optionsContainer}>
            {OPTIONS.map((option, index) => {
              const isSelected = selectedOptions.includes(option.id);
              return (
                <Animated.View 
                  key={option.id}
                  entering={FadeInDown.delay(500 + (index * 100)).duration(600)}
                  layout={Layout.springify()}
                >
                  <TouchableOpacity
                    onPress={() => toggleOption(option.id)}
                    style={[
                      styles.optionCard,
                      isSelected && styles.optionCardSelected
                    ]}
                  >
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                    <Text style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected
                    ]}>
                      {option.title}
                    </Text>
                    <Ionicons 
                      name={option.icon as any} 
                      size={20} 
                      color={isSelected ? PRIMARY_GREEN : TEXT_GRAY} 
                      style={styles.optionIcon}
                    />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>

          <Animated.View entering={FadeInDown.delay(1200).duration(800)}>
            <Pressable
              onPress={handleFinish}
              disabled={selectedOptions.length === 0}
              style={({ pressed }) => [
                styles.button,
                selectedOptions.length === 0 && styles.buttonDisabled,
                { transform: [{ scale: pressed ? 0.98 : 1 }] }
              ]}
            >
              <Text style={styles.buttonText}>Começar agora!</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 220,
    backgroundColor: '#00332a',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: (width * 0.8) / 2,
    backgroundColor: PRIMARY_GREEN,
    opacity: 0.15,
    transform: [{ scaleX: 1.8 }],
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  iconDivider: {
    width: 40,
    height: 4,
    backgroundColor: '#00B0FF',
    marginHorizontal: 10,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    marginTop: -40,
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 60,
    paddingBottom: 40,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: TEXT_GRAY,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  optionsContainer: {
    marginBottom: 30,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: BORDER_GRAY,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  optionCardSelected: {
    borderColor: PRIMARY_GREEN,
    backgroundColor: LIGHT_GREEN,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BORDER_GRAY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  checkboxSelected: {
    backgroundColor: PRIMARY_GREEN,
    borderColor: PRIMARY_GREEN,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_GRAY,
  },
  optionTextSelected: {
    color: PRIMARY_GREEN,
  },
  optionIcon: {
    marginLeft: 10,
  },
  button: {
    backgroundColor: PRIMARY_GREEN,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
});
