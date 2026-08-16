import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Colors, Radius } from '../../constants/theme';
import { Animations } from '../../constants/animations';

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  backgroundColor?: string;
  height?: number;
}

export function ProgressBar({
  progress,
  color = Colors.primary,
  backgroundColor = Colors.surfaceElevated,
  height = 8,
}: ProgressBarProps) {
  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    // animate progress value when it changes
    animatedProgress.value = Animations.timingNormal(); // set initial animation style
    animatedProgress.value = progress;
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${Math.max(0, Math.min(100, animatedProgress.value * 100))}%`,
    };
  });

  return (
    <View
      style={[
        styles.container,
        { backgroundColor, height, borderRadius: Radius.full },
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, borderRadius: Radius.full },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
