/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform, StatusBar } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ─── Design System — Meu Cesto ────────────────────────────────────────────────

/** Verde principal do app */
export const PRIMARY_GREEN = '#00A36C';
/** Fundo claro padrão das telas */
export const BG_LIGHT      = '#F8FAFC';
/** Texto escuro principal */
export const TEXT_DARK     = '#1E293B';
/** Texto cinza secundário */
export const TEXT_GRAY     = '#64748B';
/** Cor de perigo / erro */
export const DANGER        = '#EF4444';
/** Cor de alerta / aviso */
export const WARNING       = '#F59E0B';
/** Fundo escuro da tab bar */
export const TAB_BG        = '#0F172A';

/**
 * Altura da status bar:
 * - Android: usa StatusBar.currentHeight (inclui notch)
 * - iOS: 54px cobre Dynamic Island e notch do iPhone
 */
export const STATUS_BAR_HEIGHT =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 54;

/**
 * Versão compacta para telas sem Dynamic Island (ex: addItem header menor).
 */
export const STATUS_BAR_HEIGHT_SM =
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;
