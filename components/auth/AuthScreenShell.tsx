import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useAuthLayout } from './useAuthLayout';

type AuthScreenShellProps = {
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  centerContent?: boolean;
};

export function AuthScreenShell({ children, contentStyle, centerContent = false }: AuthScreenShellProps) {
  const layout = useAuthLayout();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingHorizontal: layout.horizontalPad,
              paddingTop: layout.paddingTop,
              paddingBottom: layout.paddingBottom,
            },
            centerContent && styles.scrollCentered,
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
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
