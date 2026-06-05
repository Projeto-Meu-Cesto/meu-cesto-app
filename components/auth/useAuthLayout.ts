import { useMemo } from 'react';
import { Platform, StatusBar, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useAuthLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const isCompactHeight = height < 700;
    const isNarrow = width < 360;
    const statusBar =
      Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : Math.max(insets.top, 44);

    return {
      width,
      horizontalPad: isNarrow ? 20 : 28,
      paddingTop: statusBar + (isCompactHeight ? 12 : 20),
      paddingBottom: Math.max(insets.bottom, 24) + 16,
      logoWidth: Math.min(width * (isCompactHeight ? 0.72 : 0.8), 320),
      logoHeight: Math.min(width * (isCompactHeight ? 0.38 : 0.5), isCompactHeight ? 140 : 200),
      logoMarginBottom: isCompactHeight ? 24 : 36,
      inputHeight: isCompactHeight ? 52 : 56,
      inputFontSize: isNarrow ? 15 : 16,
      labelFontSize: isNarrow ? 13 : 14,
      titleFontSize: isNarrow ? 26 : 32,
      subtitleFontSize: isNarrow ? 14 : 16,
      buttonHeight: isCompactHeight ? 52 : 56,
      formGap: isCompactHeight ? 16 : 20,
      maxFormWidth: 420,
    };
  }, [height, insets.bottom, insets.top, width]);
}
