import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { signOut } from 'firebase/auth';
import React, { useEffect, createContext, useContext, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { auth } from '../../scripts/firebaseConfig';
import { Colors, Spacing, Radius, STATUS_BAR_HEIGHT } from '../../constants/theme';
import { AppModal } from './AppModal';
import { Typography } from './Typography';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.78;

// Global Sidebar Drawer Context for layer overlay above bottom tabs
type SidebarContextType = {
  visible: boolean;
  setVisible: (visible: boolean) => void;
};

export const SidebarContext = createContext<SidebarContextType>({
  visible: false,
  setVisible: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface SidebarProps {
  visible: boolean;
  onClose: () => void;
}

type MenuItem = {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  route: string;
  isAi?: boolean;
  action?: () => void;
};

export function Sidebar({ visible, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const MENU_ITEMS: MenuItem[] = [
    { id: 'home', label: 'Início', icon: 'home-outline', route: '/home' },
    { id: 'stats', label: 'Gastos', icon: 'stats-chart-outline', route: '/stats' },
    { id: 'lists', label: 'Lista da semana', icon: 'list-outline', route: '/lists' },
    { id: 'luca', label: 'Perguntar ao Luca (IA)', icon: 'sparkles-outline', route: '/luca', isAi: true },
    { id: 'explore', label: 'Ofertas regional', icon: 'pricetag-outline', route: '/explore', action: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert('Ofertas', 'Filtro regional de ofertas em breve na sua cidade!');
      }
    },
  ];

  const CONFIG_ITEMS: MenuItem[] = [
    { id: 'config', label: 'Configurações', icon: 'settings-outline', route: '/profile' },
    { id: 'notifications', label: 'Notificações', icon: 'notifications-outline', route: '/home', action: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
        // Force navigate to home and then trigger modal (or we can just push)
        setTimeout(() => router.replace('/home'), 150);
      }
    },
  ];

  const handleNavigate = (item: MenuItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    setTimeout(() => {
      if (item.action) {
        item.action();
      } else if (item.route === '/luca') {
        router.push('/luca');
      } else {
        router.replace(item.route as any);
      }
    }, 150);
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setLogoutModalVisible(true);
  };

  const confirmLogout = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setLogoutModalVisible(false);
      onClose();
      await signOut(auth);
      router.replace('/');
    } catch (error) {
      console.warn('[Sidebar] Erro ao deslogar:', error);
    }
  };

  const showAboutInfo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Sobre o Meu Cesto',
      'O Meu Cesto é um assistente pessoal inteligente de finanças e supermercado desenvolvido para organizar suas economias cotidianas.\n\nv2.1.0 • Premium'
    );
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Backdrop with moderate opacity and fade animation */}
      <Animated.View
        entering={FadeIn.duration(240)}
        exiting={FadeOut.duration(180)}
        style={styles.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>

      {/* Drawer Sheet sliding from left to right (suave, flat, time 250ms) */}
      <Animated.View
        entering={SlideInLeft.duration(250)}
        exiting={SlideOutLeft.duration(220)}
        style={styles.sheet}
      >
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.logoBg}>
              <Ionicons name="basket" size={18} color="#080A09" />
            </View>
            <Typography variant="body" weight="heavy" color={Colors.textPrimary}>
              MEU CESTO
            </Typography>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Fechar menu">
            <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <Typography variant="caption" weight="bold" color={Colors.textMuted} style={styles.sectionTitle}>
          NAVEGAÇÃO
        </Typography>

        {/* Dynamic menu items container with active background card indicator */}
        <View style={styles.menuContainer}>
          {MENU_ITEMS.map((item) => {
            const isActive = pathname.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  item.isAi && styles.aiItem,
                  isActive && styles.menuItemActive
                ]}
                onPress={() => handleNavigate(item)}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isActive ? Colors.primary : Colors.textSecondary}
                />
                <Typography
                  variant="body"
                  weight={isActive ? 'bold' : 'medium'}
                  color={isActive ? Colors.textPrimary : Colors.textSecondary}
                  style={item.isAi && !isActive && { color: Colors.primary }}
                >
                  {item.label}
                </Typography>
                {item.isAi && (
                  <View style={styles.aiBadge}>
                    <Typography variant="caption" weight="bold" color="#080A09">IA</Typography>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.divider} />

        <Typography variant="caption" weight="bold" color={Colors.textMuted} style={styles.sectionTitle}>
          PAINEL
        </Typography>

        <View style={styles.menuContainer}>
          {CONFIG_ITEMS.map((item) => {
            const isActive = pathname.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.menuItem, isActive && styles.menuItemActive]}
                onPress={() => handleNavigate(item)}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={isActive ? Colors.primary : Colors.textSecondary}
                />
                <Typography
                  variant="body"
                  weight={isActive ? 'bold' : 'medium'}
                  color={isActive ? Colors.textPrimary : Colors.textSecondary}
                >
                  {item.label}
                </Typography>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.divider} />

        <View style={styles.menuContainer}>
          <TouchableOpacity style={styles.menuItem} onPress={showAboutInfo} activeOpacity={0.8}>
            <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
            <Typography variant="body" color={Colors.textSecondary}>
              Sobre o Meu Cesto
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Footer Area with Sign Out */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
            <Typography variant="body" weight="semibold" color={Colors.error}>
              Sair da Conta
            </Typography>
          </TouchableOpacity>

          <Typography variant="caption" color={Colors.textMuted} style={{ marginTop: Spacing.sm }}>
            Meu Cesto v2.1.0 • Premium
          </Typography>
        </View>
      </Animated.View>
      <AppModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        title="Sair da conta"
        description="Você precisará entrar novamente para acessar suas listas, pedidos e finanças."
        type="confirm"
        destructive
        confirmLabel="Sair da conta"
        cancelLabel="Continuar no app"
        onConfirm={confirmLogout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)', // ESCURECIDO E LEVEMENTE DESFOCADO (rgba 0.55)
    zIndex: 999,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: Colors.surfaceElevated, // #171B17
    zIndex: 1000,
    paddingTop: STATUS_BAR_HEIGHT + Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRightWidth: 1.5,
    borderRightColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoBg: {
    width: 32,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  menuContainer: {
    position: 'relative',
    gap: 4,
  },
  menuItem: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    borderRadius: Radius.md,
  },
  menuItemActive: {
    backgroundColor: 'rgba(183, 255, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(183, 255, 0, 0.15)',
  },
  aiItem: {
    borderColor: 'rgba(183, 255, 0, 0.15)',
    borderWidth: 1,
    backgroundColor: 'rgba(183, 255, 0, 0.04)',
  },
  aiBadge: {
    marginLeft: 'auto',
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  divider: {
    height: 1.5,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    width: '100%',
    height: 44,
    borderRadius: Radius.md,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
});
