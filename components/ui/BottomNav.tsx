import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '../../constants/theme';
import { VISIBLE_TABS } from '../../domain/navigation';
import { Typography } from './Typography';

type BottomNavProps = BottomTabBarProps & {
  onOpenActions: () => void;
};

const routeNameByPath = Object.fromEntries(
  VISIBLE_TABS.map((item) => [item.route.slice(1), item]),
);

export function BottomNav({ state, navigation, onOpenActions }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((route) => routeNameByPath[route.name]);
  const firstHalf = routes.slice(0, 2);
  const secondHalf = routes.slice(2, 4);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const item = routeNameByPath[route.name];
    const focused = state.routes[state.index]?.key === route.key;

    const handlePress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={item.label}
        onPress={handlePress}
        style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
      >
        <View style={[styles.iconFrame, focused && styles.activeIconFrame]}>
          <Ionicons
            name={(focused ? item.activeIcon : item.icon) as keyof typeof Ionicons.glyphMap}
            size={24}
            color={focused ? Colors.primary : Colors.textMuted}
          />
        </View>
        <Typography
          variant="caption"
          weight="semibold"
          color={focused ? Colors.primary : Colors.textMuted}
          numberOfLines={1}
        >
          {item.label}
        </Typography>
      </Pressable>
    );
  };

  const openActions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onOpenActions();
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, Spacing.sm) }]}
    >
      <View style={styles.bar} accessibilityRole="tablist">
        {firstHalf.map(renderTab)}
        <View style={styles.centerSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir ações rápidas"
            onPress={openActions}
            style={({ pressed }) => [styles.plusOuter, pressed && styles.plusPressed]}
          >
            <View style={styles.plusInner}>
              <Ionicons name="add" size={30} color={Colors.background} />
            </View>
          </Pressable>
        </View>
        {secondHalf.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  bar: {
    width: '100%',
    maxWidth: 430,
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xxl,
    paddingHorizontal: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  tab: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconFrame: {
    width: 32,
    height: 28,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconFrame: {
    backgroundColor: 'rgba(183, 255, 0, 0.1)',
  },
  centerSlot: {
    flex: 1,
    minWidth: 56,
    height: 72,
    alignItems: 'center',
  },
  plusOuter: {
    position: 'absolute',
    top: -14,
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({ web: { cursor: 'pointer' as const } }),
  },
  plusInner: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
  plusPressed: {
    transform: [{ scale: 0.96 }],
  },
});
