import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onHide: () => void;
}

export const Toast = ({ message, type, onHide }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(onHide, 3500);
    return () => clearTimeout(timer);
  }, [onHide]);

  const config = {
    success: { icon: 'checkmark-circle', color: '#059669', bg: '#F0FDF4' },
    error: { icon: 'alert-circle', color: '#DC2626', bg: '#FEF2F2' },
    info: { icon: 'information-circle', color: '#2563EB', bg: '#EFF6FF' },
  }[type];

  return (
    <Animated.View 
      entering={FadeInUp} 
      exiting={FadeOutUp} 
      style={[styles.container, { backgroundColor: config.bg, borderColor: config.color + '20' }]}
    >
      <Ionicons name={config.icon as any} size={24} color={config.color} />
      <Text style={[styles.text, { color: config.color }]}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 50,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    zIndex: 99999,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  text: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
});
