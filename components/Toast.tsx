import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onHide: () => void;
}

const CONFIG = {
  success: { icon: 'checkmark-circle' as const, color: '#059669', bg: '#F0FDF4', border: '#A7F3D0' },
  error:   { icon: 'alert-circle' as const,     color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  info:    { icon: 'information-circle' as const, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
};

const DURATION_MS = 3500;

export const Toast = ({ message, type, onHide }: ToastProps) => {
  const cfg = CONFIG[type];
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity    = useRef(new Animated.Value(0)).current;
  const progress   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 220, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    // Progress bar countdown
    Animated.timing(progress, {
      toValue: 0,
      duration: DURATION_MS,
      useNativeDriver: false,
    }).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity,    { toValue: 0,    duration: 200, useNativeDriver: true }),
      ]).start(onHide);
    }, DURATION_MS);

    return () => clearTimeout(timer);
  }, [onHide, opacity, progress, translateY]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity,    { toValue: 0,    duration: 180, useNativeDriver: true }),
    ]).start(onHide);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: cfg.bg, borderColor: cfg.border, transform: [{ translateY }], opacity },
      ]}
    >
      <TouchableOpacity style={styles.inner} onPress={dismiss} activeOpacity={0.9}>
        <Animated.View style={[styles.iconBg, { backgroundColor: cfg.color + '1A' }]}>
          <Ionicons name={cfg.icon} size={22} color={cfg.color} />
        </Animated.View>
        <Text style={[styles.text, { color: cfg.color }]} numberOfLines={3}>{message}</Text>
        <Ionicons name="close" size={16} color={cfg.color + '99'} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
      <Animated.View style={[styles.progressBar, { backgroundColor: cfg.color, width: progressWidth }]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 44,
    left: 16,
    right: 16,
    borderRadius: 18,
    borderWidth: 1,
    zIndex: 99999,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  progressBar: {
    height: 3,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
});
