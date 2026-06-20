import React from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  ViewStyle
} from 'react-native';
import { useAuthLayout } from './useAuthLayout';

type AuthScreenShellProps = {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  centerContent?: boolean;
};

import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export function AuthScreenShell({ children, contentStyle, centerContent = false }: AuthScreenShellProps) {
  const layout = useAuthLayout();
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAwareScrollView
  contentContainerStyle={[
    styles.scroll,
    {
      paddingHorizontal: layout.horizontalPad,
      paddingTop: layout.paddingTop,
      paddingBottom: layout.paddingBottom + 240, // era +40
    },
    centerContent && styles.scrollCentered,
    contentStyle,
  ]}
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
  bounces={false}
  enableOnAndroid
  extraScrollHeight={120} // era 20
>
        {children}
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  scrollCentered: {
    justifyContent: 'center',
  },
});
