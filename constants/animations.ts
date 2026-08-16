import { withSpring, withTiming, Easing } from 'react-native-reanimated';

/**
 * Motion System - Meu Cesto
 * Timings and presets for React Native Reanimated.
 */

export const Timings = {
  fast: 150,
  normal: 250,
  slow: 400,
};

export const Springs = {
  snappy: {
    damping: 20,
    stiffness: 250,
    mass: 1,
  },
  gentle: {
    damping: 15,
    stiffness: 120,
    mass: 1,
  }
};

export const Animations = {
  // Timing Presets
  timingFast: (config = {}) => withTiming(1, { duration: Timings.fast, easing: Easing.out(Easing.quad), ...config }),
  timingNormal: (config = {}) => withTiming(1, { duration: Timings.normal, easing: Easing.out(Easing.cubic), ...config }),
  
  // Spring Presets
  springSnappy: (val: number, config = {}) => withSpring(val, { ...Springs.snappy, ...config }),
  springGentle: (val: number, config = {}) => withSpring(val, { ...Springs.gentle, ...config }),
};
