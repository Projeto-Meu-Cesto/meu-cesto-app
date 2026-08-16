import React from 'react';
import { Text, TextProps } from 'react-native';
import { Colors, Typography as ThemeTypography } from '../../constants/theme';

interface TypographyProps extends TextProps {
  variant?: keyof typeof ThemeTypography.sizes;
  weight?: keyof typeof ThemeTypography.weights;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
}

export function Typography({
  variant = 'body',
  weight = 'regular',
  color = Colors.textPrimary,
  align = 'left',
  style,
  children,
  ...rest
}: TypographyProps) {
  const isDisplay = variant === 'display' || variant === 'heading';

  const getFontFamily = () => {
    if (isDisplay) return 'Poppins_800ExtraBold';

    switch (weight) {
      case 'medium': return 'Inter_500Medium';
      case 'semibold': return 'Inter_600SemiBold';
      case 'bold': return 'Inter_700Bold';
      case 'heavy': return 'Inter_800ExtraBold';
      default: return 'Inter_400Regular';
    }
  };

  return (
    <Text
      style={[
        {
          fontSize: ThemeTypography.sizes[variant],
          lineHeight: ThemeTypography.lineHeights[variant],
          fontFamily: getFontFamily(),
          color,
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
