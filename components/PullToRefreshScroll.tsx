import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PRIMARY_GREEN } from '../constants/theme';

const PULL_THRESHOLD = 64;
const MAX_PULL = 100;

type PullToRefreshScrollProps = ScrollViewProps & {
  onRefresh: () => Promise<void>;
  refreshOffset?: number;
  /** Cor visível ao puxar acima do conteúdo (deve combinar com o header). */
  backgroundColor?: string;
  onRefreshingChange?: (refreshing: boolean) => void;
  /** Impede rolar para baixo; mantém apenas o overscroll no topo (pull to refresh). */
  lockScrollDown?: boolean;
};

export function PullToRefreshScroll({
  onRefresh,
  refreshOffset = 0,
  backgroundColor = PRIMARY_GREEN,
  onRefreshingChange,
  lockScrollDown = false,
  children,
  contentContainerStyle,
  onScroll,
  onMomentumScrollEnd,
  style,
  ...rest
}: PullToRefreshScrollProps) {
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pullAnim = useRef(new Animated.Value(0)).current;
  const pullDistanceRef = useRef(0);

  const clampScrollDown = useCallback(
    (y: number) => {
      if (lockScrollDown && y > 0 && !refreshing) {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
        return true;
      }
      return false;
    },
    [lockScrollDown, refreshing]
  );

  const setRefreshingState = useCallback(
    (value: boolean) => {
      setRefreshing(value);
      onRefreshingChange?.(value);
    },
    [onRefreshingChange]
  );

  const runRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshingState(true);
    try {
      await onRefresh();
    } finally {
      setRefreshingState(false);
      Animated.spring(pullAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start();
      pullDistanceRef.current = 0;
    }
  }, [onRefresh, pullAnim, refreshing, setRefreshingState]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = event.nativeEvent.contentOffset.y;
    if (clampScrollDown(y)) return;

    if (!refreshing && y < 0) {
      const pull = Math.min(-y, MAX_PULL);
      pullDistanceRef.current = pull;
      pullAnim.setValue(pull);
    }
    onScroll?.(event);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    clampScrollDown(event.nativeEvent.contentOffset.y);
    onMomentumScrollEnd?.(event);
  };

  const handleScrollEndDrag = () => {
    if (pullDistanceRef.current >= PULL_THRESHOLD && !refreshing) {
      Animated.timing(pullAnim, {
        toValue: PULL_THRESHOLD,
        duration: 150,
        useNativeDriver: true,
      }).start();
      runRefresh();
    } else if (!refreshing) {
      Animated.spring(pullAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start();
      pullDistanceRef.current = 0;
    }
  };

  const indicatorTranslate = pullAnim.interpolate({
    inputRange: [0, PULL_THRESHOLD, MAX_PULL],
    outputRange: [-48, refreshOffset + 8, refreshOffset + 16],
    extrapolate: 'clamp',
  });

  const indicatorOpacity = pullAnim.interpolate({
    inputRange: [0, 20, PULL_THRESHOLD],
    outputRange: [0, 0.6, 1],
    extrapolate: 'clamp',
  });

  const iconRotate = pullAnim.interpolate({
    inputRange: [0, PULL_THRESHOLD],
    outputRange: ['0deg', '180deg'],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.wrapper, { backgroundColor }, style]}>
      <Animated.View
        style={[
          styles.indicator,
          {
            top: refreshOffset,
            opacity: refreshing ? 1 : indicatorOpacity,
            transform: [{ translateY: refreshing ? refreshOffset + 8 : indicatorTranslate }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={styles.indicatorInner}>
          {refreshing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Animated.View style={{ transform: [{ rotate: iconRotate }] }}>
              <Ionicons name="arrow-down" size={20} color="#fff" />
            </Animated.View>
          )}
          <Text style={styles.indicatorText}>
            {refreshing ? 'Atualizando...' : 'Solte para atualizar'}
          </Text>
        </View>
      </Animated.View>

      <ScrollView
        {...rest}
        ref={scrollRef}
        style={styles.scroll}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        bounces={lockScrollDown ? true : rest.bounces}
        alwaysBounceVertical={lockScrollDown ? true : rest.alwaysBounceVertical}
        contentContainerStyle={contentContainerStyle}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  indicatorInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  indicatorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
});
