import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, User } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import 'react-native-reanimated';
import { ToastProvider } from '../context/ToastContext';
import { CartProvider } from '../context/CartContext';
import { auth } from '../scripts/firebaseConfig';

import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Notifications from 'expo-notifications';

// Google Fonts loading
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });

    return unsubscribe;
  }, []);

  const isReady = authChecked && fontsLoaded;

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inProtectedScreen = [
      'luca', 'addItem', 'insights', 'catalog', 'cart', 'checkout', 'orders', 'order', 'rewards', 'notifications'
    ].includes(segments[0]);

    if (!user && (inAuthGroup || inProtectedScreen)) {
      router.replace('/');
    } else if (user && !['(tabs)', 'onboarding', 'addItem', 'luca', 'catalog', 'cart', 'checkout', 'orders', 'order', 'rewards', 'notifications'].includes(segments[0])) {
      router.replace('/(tabs)/home');
    }
  }, [user, isReady, segments, router]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#080A09' }}>
        <ActivityIndicator size="large" color="#B7FF00" />
      </View>
    );
  }

  return (
    <ToastProvider>
      <CartProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="luca" options={{ headerShown: false }} />
            <Stack.Screen name="addItem" options={{ headerShown: false }} />
            <Stack.Screen name="catalog" options={{ headerShown: false }} />
            <Stack.Screen name="cart" options={{ headerShown: false }} />
            <Stack.Screen name="checkout" options={{ headerShown: false }} />
            <Stack.Screen name="orders" options={{ headerShown: false }} />
            <Stack.Screen name="order/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="rewards" options={{ headerShown: false }} />
            <Stack.Screen name="insights" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false, presentation: 'modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </CartProvider>
    </ToastProvider>
  );
}
