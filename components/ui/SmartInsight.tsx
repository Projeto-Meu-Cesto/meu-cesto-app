import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../constants/theme';
import { Card } from './Card';
import { Typography } from './Typography';

export type InsightType = 'economy' | 'behavior' | 'price' | 'list' | 'category';

interface SmartInsightProps {
  type: InsightType;
  message: string;
  actionLabel?: string;
  onPressAction?: () => void;
}

export function SmartInsight({ type, message, actionLabel, onPressAction }: SmartInsightProps) {
  const getInsightStyle = () => {
    switch (type) {
      case 'economy':
        return {
          icon: 'trending-down-outline',
          iconColor: Colors.primary,
          title: 'Economia',
        };
      case 'behavior':
        return {
          icon: 'bulb-outline',
          iconColor: '#38BDF8', // Light blue
          title: 'Hábito',
        };
      case 'price':
        return {
          icon: 'pricetag-outline',
          iconColor: Colors.warning,
          title: 'Preço',
        };
      case 'list':
        return {
          icon: 'cart-outline',
          iconColor: Colors.textSecondary,
          title: 'Lista',
        };
      case 'category':
        return {
          icon: 'pie-chart-outline',
          iconColor: '#EC4899', // Pink
          title: 'Categoria',
        };
    }
  };

  const config = getInsightStyle();

  return (
    <Card elevated padding="md" style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name={config.icon as any} size={18} color={config.iconColor} />
          <Typography variant="caption" weight="semibold" color={Colors.textSecondary} style={styles.title}>
            {config.title.toUpperCase()}
          </Typography>
        </View>
        {actionLabel && onPressAction && (
          <Typography 
            variant="caption" 
            weight="bold" 
            color={Colors.primary} 
            onPress={onPressAction}
            accessibilityRole="button"
          >
            {actionLabel}
          </Typography>
        )}
      </View>
      <Typography variant="body" color={Colors.textPrimary} style={styles.message}>
        {message}
      </Typography>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    letterSpacing: 0.5,
  },
  message: {
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
});
