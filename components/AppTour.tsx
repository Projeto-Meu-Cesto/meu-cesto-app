import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PRIMARY_GREEN, TEXT_DARK, TEXT_GRAY } from '../constants/theme';

export type TourStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tabHref?: '/(tabs)/home' | '/(tabs)/lists' | '/(tabs)/stats' | '/luca' | '/(tabs)/profile';
  tabLabel?: string;
};

export const APP_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Meu Cesto!',
    description:
      'Organize compras, acompanhe gastos e receba dicas inteligentes. Este tour rápido mostra onde fica cada coisa.',
    icon: 'basket-outline',
    tabHref: '/(tabs)/home',
  },
  {
    id: 'home',
    title: 'Início',
    description:
      'Veja o resumo do mês, gastos confirmados, itens pendentes e os últimos produtos da sua lista.',
    icon: 'home',
    tabHref: '/(tabs)/home',
    tabLabel: 'Início',
  },
  {
    id: 'lists',
    title: 'Lista de compras',
    description:
      'Adicione itens, marque o que já comprou e informe preços ao finalizar para calcular seus gastos.',
    icon: 'cart',
    tabHref: '/(tabs)/lists',
    tabLabel: 'Lista',
  },
  {
    id: 'stats',
    title: 'Finanças',
    description:
      'Acompanhe quanto gastou por mês, por categoria e veja a evolução das suas compras.',
    icon: 'bar-chart',
    tabHref: '/(tabs)/stats',
    tabLabel: 'Finanças',
  },
  {
    id: 'luca',
    title: 'Luca — assistente com IA',
    description:
      'Converse com o Luca para analisar gastos, planejar o mercado e receber dicas personalizadas.',
    icon: 'sparkles',
    tabHref: '/luca',
    tabLabel: 'Luca',
  },
  {
    id: 'profile',
    title: 'Perfil',
    description:
      'Gerencie sua conta, preferências e configurações do app.',
    icon: 'person',
    tabHref: '/(tabs)/profile',
    tabLabel: 'Perfil',
  },
  {
    id: 'done',
    title: 'Tudo pronto!',
    description:
      'Comece adicionando itens na Lista. Na próxima compra, marque como comprado e informe os preços.',
    icon: 'checkmark-circle',
    tabHref: '/(tabs)/home',
  },
];

type AppTourProps = {
  visible: boolean;
  onFinish: () => void;
};

export function AppTour({ visible, onFinish }: AppTourProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);

  const step = APP_TOUR_STEPS[stepIndex];
  const isLast = stepIndex === APP_TOUR_STEPS.length - 1;

  const goToStep = useCallback(
    (index: number) => {
      const next = APP_TOUR_STEPS[index];
      if (next.tabHref) {
        router.replace(next.tabHref);
      }
      setStepIndex(index);
    },
    [router]
  );

  const handleNext = () => {
    if (isLast) {
      onFinish();
      setStepIndex(0);
      return;
    }
    goToStep(stepIndex + 1);
  };

  const handleSkip = () => {
    onFinish();
    setStepIndex(0);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleSkip}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleSkip} />

        <View style={[styles.card, { marginBottom: Math.max(insets.bottom, 20) + 88 }]}>
          <View style={styles.iconCircle}>
            <Ionicons name={step.icon} size={32} color={PRIMARY_GREEN} />
          </View>

          {step.tabLabel ? (
            <View style={styles.tabPill}>
              <Text style={styles.tabPillText}>Aba: {step.tabLabel}</Text>
            </View>
          ) : null}

          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.dots}>
            {APP_TOUR_STEPS.map((s, i) => (
              <View key={s.id} style={[styles.dot, i === stepIndex && styles.dotActive]} />
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Pular</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleNext} style={styles.nextBtn} activeOpacity={0.85}>
              <Text style={styles.nextText}>{isLast ? 'Começar' : 'Próximo'}</Text>
              <Ionicons name={isLast ? 'checkmark' : 'arrow-forward'} size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.tabHintBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <Text style={styles.tabHintLabel}>Navegação principal</Text>
          <View style={styles.tabHintRow}>
            {[
              { icon: 'home' as const, label: 'Início' },
              { icon: 'cart' as const, label: 'Lista' },
              { icon: 'bar-chart' as const, label: 'Finanças' },
              { icon: 'sparkles' as const, label: 'Luca' },
              { icon: 'person' as const, label: 'Perfil' },
            ].map((tab) => {
              const active = step.tabLabel === tab.label;
              return (
                <View key={tab.label} style={[styles.tabHintItem, active && styles.tabHintItemActive]}>
                  <Ionicons
                    name={tab.icon}
                    size={18}
                    color={active ? PRIMARY_GREEN : '#64748B'}
                  />
                  <Text style={[styles.tabHintText, active && styles.tabHintTextActive]}>{tab.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  tabPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY_GREEN,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_DARK,
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: TEXT_GRAY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
  },
  dotActive: {
    width: 22,
    backgroundColor: PRIMARY_GREEN,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  skipBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_GRAY,
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY_GREEN,
    height: 52,
    borderRadius: 26,
  },
  nextText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  tabHintBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    backgroundColor: '#0F172A',
    borderRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 10,
  },
  tabHintLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  tabHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tabHintItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 12,
  },
  tabHintItemActive: {
    backgroundColor: 'rgba(0, 163, 108, 0.15)',
  },
  tabHintText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  tabHintTextActive: {
    color: PRIMARY_GREEN,
  },
});
