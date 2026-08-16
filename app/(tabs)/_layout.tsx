import { Ionicons } from '@expo/vector-icons';
import { Tabs, useFocusEffect, useRouter } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { 
  SlideInDown,
  SlideOutDown
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { AppTour } from '../../components/AppTour';
import { takeAppTourSession } from '../../context/tourSession';
import { auth } from '../../scripts/firebaseConfig';
import { completeAppTour, shouldShowAppTour } from '../../scripts/tourStorage';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { QUICK_ACTIONS } from '../../domain/navigation';
import { BottomNav } from '../../components/ui/BottomNav';
import { SidebarContext, Sidebar } from '../../components/ui/Sidebar';
import { Typography } from '../../components/ui/Typography';

export default function TabLayout() {
  const [sidebarVisible, setSidebarVisible] = useState(false);

  return (
    <SidebarContext.Provider value={{ visible: sidebarVisible, setVisible: setSidebarVisible }}>
      <TabLayoutContent />
      <Sidebar visible={sidebarVisible} onClose={() => setSidebarVisible(false)} />
    </SidebarContext.Provider>
  );
}

function TabLayoutContent() {
  const router = useRouter();
  const [tourVisible, setTourVisible] = useState(false);
  const [tourUid, setTourUid] = useState<string | null>(null);
  const tourCheckedRef = useRef(false);
  
  // Action Hub State
  const [actionHubVisible, setActionHubVisible] = useState(false);

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

  useEffect(() => {
    if (Platform.OS !== 'web' || !actionHubVisible) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActionHubVisible(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [actionHubVisible]);

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

  const toggleActionHub = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActionHubVisible(!actionHubVisible);
  };

  const handleAction = (route: string) => {
    setActionHubVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(route as any);
  };

  return (
    <>
      <Tabs
        tabBar={(props) => <BottomNav {...props} onOpenActions={toggleActionHub} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{ title: 'Início' }}
        />
        
        <Tabs.Screen
          name="stats"
          options={{ title: 'Gastos' }}
        />

        <Tabs.Screen
          name="plus"
          options={{ title: 'Ações' }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              toggleActionHub();
            }
          }}
        />

        <Tabs.Screen
          name="lists"
          options={{ title: 'Lista' }}
        />

        <Tabs.Screen
          name="profile"
          options={{ title: 'Perfil' }}
        />


      </Tabs>

      <AppTour visible={tourVisible} onFinish={handleTourFinish} />

      {/* Action Hub Overlay */}
      <Modal
        visible={actionHubVisible}
        transparent
        animationType="none"
        onRequestClose={toggleActionHub}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={toggleActionHub} />
          
          <Animated.View 
            entering={SlideInDown.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={styles.actionPanel}
          >
            <Typography variant="title" weight="bold" color={Colors.textPrimary} style={styles.panelTitle}>
              Ações Rápidas
            </Typography>

            <View style={styles.actionsContainer}>
              {QUICK_ACTIONS.map((action) => (
                <Pressable
                  key={action.route}
                  accessibilityRole="button"
                  style={styles.actionRow}
                  onPress={() => handleAction(action.route)}
                >
                  <View style={styles.actionIconContainer}>
                    <Ionicons
                      name={action.icon as keyof typeof Ionicons.glyphMap}
                      size={22}
                      color={Colors.primary}
                    />
                  </View>
                  <Typography variant="body" weight="semibold" color={Colors.textPrimary}>
                    {action.label}
                  </Typography>
                </Pressable>
              ))}
            </View>

            <Pressable style={styles.closeButton} onPress={toggleActionHub}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  actionPanel: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xxl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xxxl,
  },
  panelTitle: {
    marginBottom: Spacing.xl,
  },
  actionsContainer: {
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(183, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});
