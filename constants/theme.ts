import { Platform, StatusBar } from 'react-native';

/**
 * Design System - Meu Cesto
 * Direção Visual: DARK / PREMIUM / FRIENDLY / INTELLIGENT / MOBILE-FIRST
 * Dark Mode Exclusivo.
 */

export const Colors = {
  background: '#080A09',
  surface: '#111411',
  surfaceElevated: '#171B17',
  border: '#242A24',
  primary: '#B7FF00',
  primaryDark: '#83B800',
  textPrimary: '#F5F7F2',
  textSecondary: '#A4ABA1',
  textMuted: '#6F766D',
  error: '#FF5C5C',
  warning: '#FFC857',
  
  // Aliases required by some Expo standard components (if they use Colors.light.text for some reason)
  light: {
    text: '#F5F7F2',
    background: '#080A09',
    tint: '#B7FF00',
    icon: '#A4ABA1',
    tabIconDefault: '#6F766D',
    tabIconSelected: '#B7FF00',
  },
  dark: {
    text: '#F5F7F2',
    background: '#080A09',
    tint: '#B7FF00',
    icon: '#A4ABA1',
    tabIconDefault: '#6F766D',
    tabIconSelected: '#B7FF00',
  }
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  xxxxl: 64,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export function nestedRadius(innerRadius: number, padding: number): number {
  return innerRadius + padding;
}

export const Typography = {
  fonts: Platform.select({
    ios: {
      sans: 'System',
      serif: 'System',
      rounded: 'System',
      mono: 'System',
    },
    default: {
      sans: 'sans-serif',
      serif: 'serif',
      rounded: 'sans-serif',
      mono: 'monospace',
    },
  }),
  sizes: {
    display: 32,
    heading: 24,
    title: 18,
    body: 16,
    caption: 12,
  },
  lineHeights: {
    display: 40,
    heading: 32,
    title: 24,
    body: 24,
    caption: 16,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    heavy: '800' as const,
  }
};

export const STATUS_BAR_HEIGHT =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 54;

export const STATUS_BAR_HEIGHT_SM =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

// --- DEPRECATED ALIASES FOR MIGRATION ---
export const PRIMARY_GREEN = Colors.primary;
export const BG_LIGHT = Colors.background;
export const TEXT_DARK = Colors.textPrimary;
export const TEXT_GRAY = Colors.textSecondary;
export const DANGER = Colors.error;
export const WARNING = Colors.warning;
export const TAB_BG = '#0F172A'; // Keep old for now if used directly
export const Fonts = Typography.fonts;
