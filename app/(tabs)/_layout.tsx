import { Ionicons } from '@expo/vector-icons';
import { Tabs, useFocusEffect } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import { AppTour } from '../../components/AppTour';
import { takeAppTourSession } from '../../context/tourSession';
import { auth } from '../../scripts/firebaseConfig';
import { completeAppTour, shouldShowAppTour } from '../../scripts/tourStorage';

const PRIMARY_GREEN = '#00A36C';
const TAB_BG = '#0F172A';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 375;

export default function TabLayout() {
  const [tourVisible, setTourVisible] = useState(false);
  const [tourUid, setTourUid] = useState<string | null>(null);
  const tourCheckedRef = useRef(false);

  const openTourIfNeeded = useCallback(async (user: User) => {
    if (tourVisible) return;

    try {
      if (takeAppTourSession(user.uid)) {
        setTourUid(user.uid);
        setTourVisible(true);
        return;
      }

      const show = await shouldShowAppTour(user.uid);
      if (show) {
        setTourUid(user.uid);
        setTourVisible(true);
      }
    } catch (error) {
      console.warn('[Tour] Não foi possível verificar status do tour.', error);
    }
  }, [tourVisible]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTourVisible(false);
        setTourUid(null);
        tourCheckedRef.current = false;
        return;
      }

      await openTourIfNeeded(user);
      tourCheckedRef.current = true;
    });

    return unsub;
  }, [openTourIfNeeded]);

  useFocusEffect(
    useCallback(() => {
      const user = auth.currentUser;
      if (!user) return;

      const retry = setTimeout(() => {
        openTourIfNeeded(user);
      }, tourCheckedRef.current ? 500 : 100);

      return () => clearTimeout(retry);
    }, [openTourIfNeeded])
  );

  const handleTourFinish = useCallback(async () => {
    setTourVisible(false);
    if (tourUid) {
      await completeAppTour(tourUid);
    }
  }, [tourUid]);

  return (
    <>
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
    <AppTour visible={tourVisible} onFinish={handleTourFinish} />
    </>
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
