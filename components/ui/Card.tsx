import React from 'react';
import { View, ViewProps, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../../constants/theme';

interface CardProps extends ViewProps {
  elevated?: boolean;
  padding?: keyof typeof Spacing;
  radius?: keyof typeof Radius;
}

export function Card({
  elevated = false,
  padding = 'lg',
  radius = 'xl',
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? Colors.surfaceElevated : Colors.surface,
          padding: Spacing[padding],
          borderRadius: Radius[radius],
          borderColor: elevated ? 'transparent' : Colors.border,
          borderWidth: elevated ? 0 : 1,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
});
