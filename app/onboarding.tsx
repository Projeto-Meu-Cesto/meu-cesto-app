import React, { useState } from 'react';
import { StyleSheet, View, StatusBar, Dimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Colors, Spacing, Radius } from '../constants/theme';
import { Typography } from '../components/ui/Typography';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/ProgressBar';

const { width } = Dimensions.get('window');

const QUESTIONS = [
  {
    id: 'frequency',
    title: 'Como você faz compras?',
    subtitle: 'Nos ajude a entender a sua rotina de mercado.',
    options: [
      { id: 'weekly', label: 'Toda semana', icon: 'calendar-outline' },
      { id: 'biweekly', label: 'A cada 15 dias', icon: 'repeat-outline' },
      { id: 'monthly', label: 'Uma vez por mês', icon: 'wallet-outline' },
      { id: 'needed', label: 'Quando preciso', icon: 'cart-outline' },
    ],
    multiple: false,
  },
  {
    id: 'improve',
    title: 'O que quer melhorar?',
    subtitle: 'Selecione todos os objetivos que fazem sentido.',
    options: [
      { id: 'spend_less', label: 'Gastar menos', icon: 'trending-down-outline' },
      { id: 'organize', label: 'Organizar minhas compras', icon: 'checkbox-outline' },
      { id: 'best_prices', label: 'Encontrar melhores preços', icon: 'search-outline' },
      { id: 'understand', label: 'Entender meus gastos', icon: 'pie-chart-outline' },
    ],
    multiple: true,
  },
  {
    id: 'goal',
    title: 'Qual seu maior objetivo?',
    subtitle: 'Esse será o foco principal do Luca, seu copiloto.',
    options: [
      { id: 'economize', label: 'ECONOMIZAR', icon: 'cash-outline' },
      { id: 'organize_all', label: 'ORGANIZAR', icon: 'list-outline' },
      { id: 'control', label: 'CONTROLAR', icon: 'shield-checkmark-outline' },
    ],
    multiple: false,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({
    frequency: [],
    improve: [],
    goal: [],
  });

  const currentQuestion = QUESTIONS[currentStep];

  const handleSelectOption = (optionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const questionId = currentQuestion.id;
    const isMultiple = currentQuestion.multiple;

    if (isMultiple) {
      const currentAnswers = answers[questionId];
      if (currentAnswers.includes(optionId)) {
        setAnswers({
          ...answers,
          [questionId]: currentAnswers.filter((id) => id !== optionId),
        });
      } else {
        setAnswers({
          ...answers,
          [questionId]: [...currentAnswers, optionId],
        });
      }
    } else {
      setAnswers({
        ...answers,
        [questionId]: [optionId],
      });
    }
  };

  const handleNext = () => {
    if (currentStep < QUESTIONS.length - 1) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCurrentStep(currentStep + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/home');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentStep(currentStep - 1);
    }
  };

  const hasAnswer = answers[currentQuestion.id].length > 0;
  const progress = (currentStep + 1) / QUESTIONS.length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Top Header */}
      <View style={styles.header}>
        {currentStep > 0 ? (
          <Button
            variant="ghost"
            label=""
            leftIcon={<Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />}
            onPress={handleBack}
            style={styles.backButton}
          />
        ) : (
          <View style={styles.backPlaceholder} />
        )}
        <Typography variant="body" weight="semibold" color={Colors.textSecondary}>
          Passo {currentStep + 1} de {QUESTIONS.length}
        </Typography>
        <View style={styles.backPlaceholder} />
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <ProgressBar progress={progress} color={Colors.primary} height={4} />
      </View>

      {/* Slide Transition Area */}
      <Animated.View 
        key={currentStep}
        entering={SlideInRight.duration(300)}
        exiting={SlideOutLeft.duration(300)}
        style={styles.slide}
      >
        <View style={styles.titleWrap}>
          <Typography variant="heading" weight="bold" color={Colors.textPrimary} style={styles.title}>
            {currentQuestion.title}
          </Typography>
          <Typography variant="body" color={Colors.textSecondary} style={styles.subtitle}>
            {currentQuestion.subtitle}
          </Typography>
        </View>

        <View style={styles.optionsWrap}>
          {currentQuestion.options.map((option) => {
            const isSelected = answers[currentQuestion.id].includes(option.id);
            return (
              <Card
                key={option.id}
                elevated={isSelected}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
              >
                <Pressable
                  style={styles.optionPressable}
                  onPress={() => handleSelectOption(option.id)}
                >
                  <View style={styles.optionIconContainer}>
                    <Ionicons 
                      name={option.icon as any} 
                      size={24} 
                      color={isSelected ? Colors.background : Colors.textSecondary} 
                    />
                  </View>
                  <Typography 
                    variant="body" 
                    weight={isSelected ? 'bold' : 'regular'}
                    color={isSelected ? Colors.background : Colors.textPrimary}
                    style={styles.optionLabel}
                  >
                    {option.label}
                  </Typography>
                  {currentQuestion.multiple && (
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected
                    ]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color={Colors.primary} />}
                    </View>
                  )}
                </Pressable>
              </Card>
            );
          })}
        </View>
      </Animated.View>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <Button
          variant="primary"
          label={currentStep === QUESTIONS.length - 1 ? 'Montar meu Cesto' : 'Continuar'}
          disabled={!hasAnswer}
          onPress={handleNext}
          style={styles.submitButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'space-between',
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + Spacing.lg : 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  backButton: {
    padding: 0,
    width: 44,
    height: 44,
  },
  backPlaceholder: {
    width: 44,
  },
  progressContainer: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  slide: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  titleWrap: {
    marginBottom: Spacing.xxl,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  subtitle: {
    lineHeight: 22,
  },
  optionsWrap: {
    gap: Spacing.md,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 0,
  },
  optionCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  optionPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  optionIconContainer: {
    marginRight: Spacing.md,
  },
  optionLabel: {
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: Colors.background,
    borderColor: Colors.background,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxxxl,
  },
  submitButton: {
    width: '100%',
  },
});
