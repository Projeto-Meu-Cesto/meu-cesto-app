import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../../constants/theme';
import { Typography } from './Typography';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'warning' | 'error';
  size?: 'sm' | 'md';
}

export function Badge({ label, variant = 'primary', size = 'sm' }: BadgeProps) {
  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary': return Colors.primary;
      case 'secondary': return Colors.surfaceElevated;
      case 'warning': return 'rgba(255, 200, 87, 0.15)';
      case 'error': return 'rgba(255, 92, 92, 0.15)';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary': return '#080A09';
      case 'secondary': return Colors.textPrimary;
      case 'warning': return Colors.warning;
      case 'error': return Colors.error;
    }
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: getBackgroundColor(),
          paddingHorizontal: size === 'sm' ? Spacing.sm : Spacing.md,
          paddingVertical: size === 'sm' ? 2 : Spacing.xs,
        },
      ]}
    >
      <Typography
        variant="caption"
        weight="semibold"
        color={getTextColor()}
      >
        {label}
      </Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
