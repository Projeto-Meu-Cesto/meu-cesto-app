import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';

const PRIMARY_GREEN = '#00A36C';
const TAB_BG = '#0F172A';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 375;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PRIMARY_GREEN,
        tabBarInactiveTintColor: '#64748B',
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: isSmallScreen ? 10 : 11,
          fontWeight: '700',
          marginBottom: Platform.OS === 'ios' ? 0 : 8,
        },
        tabBarStyle: {
          position: 'absolute',
          bottom: Platform.OS === 'ios' ? 25 : 12,
          marginHorizontal: isSmallScreen ? 20 : 30, // substitui left e right
          height: Platform.OS === 'ios' ? 75 : 68,
          backgroundColor: TAB_BG,
          borderRadius: 40,
          borderTopWidth: 0,
          paddingTop: isSmallScreen ? 8 : 12,
          paddingHorizontal: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 10,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarLabel: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconBg]}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={isSmallScreen ? 20 : 22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          tabBarLabel: 'Lista',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconBg]}>
              <Ionicons
                name={focused ? 'cart' : 'cart-outline'}
                size={isSmallScreen ? 21 : 24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarLabel: 'Finanças',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconBg]}>
              <Ionicons
                name={focused ? 'bar-chart' : 'bar-chart-outline'}
                size={isSmallScreen ? 20 : 22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="luca-tab"
        options={{
          tabBarLabel: 'Luca',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconBg]}>
              <Ionicons
                name={focused ? 'sparkles' : 'sparkles-outline'}
                size={isSmallScreen ? 20 : 22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarLabel: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.activeIconBg]}>
              <Ionicons
                name={focused ? 'person' : 'person-outline'}
                size={isSmallScreen ? 20 : 22}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrapper: {
    width: isSmallScreen ? 36 : 42,
    height: isSmallScreen ? 36 : 42,
    borderRadius: isSmallScreen ? 18 : 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  activeIconBg: {
    backgroundColor: 'rgba(0, 163, 108, 0.15)',
  },

});
