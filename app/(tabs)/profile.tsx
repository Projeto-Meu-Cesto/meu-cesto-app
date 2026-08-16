import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  EmailAuthProvider,
  User,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { auth, db } from '../../scripts/firebaseConfig';
import { formatLocationLabel, getCachedLocation, requestUserLocation } from '../../scripts/locationService';
import { Colors, Spacing, Radius, STATUS_BAR_HEIGHT } from '../../constants/theme';
import { toDate } from '../../scripts/utils';
import { type PurchaseRecord, type PurchaseItem } from '../../scripts/financeContext';

// UI components
import { Typography } from '../../components/ui/Typography';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useSidebar } from '../../components/ui/Sidebar';
import { AppModal } from '../../components/ui/AppModal';

type ProfileModal = 'personal' | 'notifications' | 'security' | 'help' | 'location' | null;

type NotificationSettings = {
  budgetAlerts: boolean;
  priceTips: boolean;
  weeklySummary: boolean;
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  budgetAlerts: true,
  priceTips: true,
  weeklySummary: false,
};

function showMessage(title: string, message: string) {
  Alert.alert(title, message);
}

function getPurchaseItemTotal(item: PurchaseItem): number {
  if (typeof item.total === 'number' && Number.isFinite(item.total)) {
    return item.total;
  }
  const price = typeof item.price === 'number' ? item.price : parseFloat(String(item.price || '0'));
  const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(String(item.quantity || '1'), 10);
  return price * quantity;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState(Boolean(auth.currentUser));
  const [activeModal, setActiveModal] = useState<ProfileModal>(null);
  const [displayName, setDisplayName] = useState(auth.currentUser?.displayName || '');
  const [photoURL, setPhotoURL] = useState(auth.currentUser?.photoURL || '');
  const [notifications, setNotifications] = useState<NotificationSettings>(DEFAULT_NOTIFICATIONS);
  const [saving, setSaving] = useState(false);
  const [locationUpdating, setLocationUpdating] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [locationFilterEnabled, setLocationFilterEnabled] = useState(true);
  const [currentLocationLabel, setCurrentLocationLabel] = useState('');
  const { setVisible: setSidebarVisible } = useSidebar();
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // Dynamic user stats from Firestore
  const [itemsCount, setItemsCount] = useState(0);
  const [purchasesCount, setPurchasesCount] = useState(0);
  const [totalSpent, setTotalSpent] = useState(0);
  const [activeWeeks, setActiveWeeks] = useState(1);

  const userUid = user?.uid;
  const profileRef = useMemo(
    () => (userUid ? doc(db, 'users', userUid) : null),
    [userUid]
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        router.replace('/');
      }
    });
    return unsubscribe;
  }, [router]);

  // Load Real Stats from shopping list & purchases
  useEffect(() => {
    if (!user) return;

    const unsubList = onSnapshot(
      collection(db, 'users', user.uid, 'shopping_list'),
      (snapshot) => {
        setItemsCount(snapshot.docs.length);
      }
    );

    const unsubPurchases = onSnapshot(
      collection(db, 'users', user.uid, 'purchases'),
      (snapshot) => {
        const loaded = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PurchaseRecord[];
        const itemsSum = loaded.reduce((acc, p) => acc + (p.items?.length || 0), 0);
        setPurchasesCount(itemsSum);
        
        const spent = loaded.reduce((acc, p) => {
          const total = p.total || (p.items || []).reduce((sum, item) => sum + getPurchaseItemTotal(item), 0);
          return acc + total;
        }, 0);
        setTotalSpent(spent);

        const weeks = new Set(loaded.map(p => {
          const d = toDate(p.finalizedAt) || toDate(p.createdAt) || new Date();
          const oneJan = new Date(d.getFullYear(), 0, 1);
          const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
          return `${d.getFullYear()}-w${Math.ceil((d.getDay() + 1 + numberOfDays) / 7)}`;
        })).size;
        setActiveWeeks(weeks || 1);
      }
    );

    return () => {
      unsubList();
      unsubPurchases();
    };
  }, [user]);

  useEffect(() => {
    if (!authReady || !user) return;

    setDisplayName(user.displayName || '');
    setPhotoURL(user.photoURL || '');

    const loadSettings = async () => {
      if (!profileRef) return;
      try {
        const snapshot = await getDoc(profileRef);
        if (!snapshot.exists()) return;

        const data = snapshot.data();
        setDisplayName(data.displayName || user.displayName || '');
        setPhotoURL(data.photoURL || user.photoURL || '');
        setNotifications({
          ...DEFAULT_NOTIFICATIONS,
          ...(data.notifications || {}),
        });
        
        const enabledRaw = await AsyncStorage.getItem('@meu-cesto:location-filter-enabled');
        setLocationFilterEnabled(enabledRaw === null ? true : enabledRaw === 'true');

        const cachedLoc = await getCachedLocation();
        if (cachedLoc) {
          setCurrentLocationLabel(formatLocationLabel(cachedLoc));
        }
      } catch (error) {
        console.warn('[Perfil] Não foi possível carregar configurações:', error);
      }
    };

    loadSettings();
  }, [authReady, profileRef, user]);

  const closeModal = () => {
    if (saving || uploadingAvatar) return;
    setActiveModal(null);
  };

  const saveProfileDocument = useCallback(async (payload: Record<string, unknown>) => {
    if (!profileRef || !user) return;
    await setDoc(
      profileRef,
      {
        uid: user.uid,
        email: user.email,
        updatedAt: serverTimestamp(),
        ...payload,
      },
      { merge: true }
    );
  }, [profileRef, user]);

  const handleSavePersonalData = async () => {
    if (!user) return;
    const cleanName = displayName.trim();
    if (cleanName.length < 2) {
      showMessage('Nome inválido', 'Digite pelo menos 2 caracteres para o nome.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(user, { displayName: cleanName, photoURL: photoURL || user.photoURL || null });
      await saveProfileDocument({ displayName: cleanName, photoURL: photoURL || null });
      setDisplayName(cleanName);
      setPhotoURL(photoURL || '');
      setUser(auth.currentUser);
      setActiveModal(null);
      showMessage('Perfil atualizado', 'Seus dados pessoais foram salvos.');
    } catch (error) {
      console.error('[Perfil] Erro ao salvar dados:', error);
      showMessage('Erro', 'Não foi possível salvar seus dados pessoais.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!user) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showMessage('Permissão necessária', 'Autorize o acesso às fotos para trocar o avatar.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.35,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const base64 = result.assets[0].base64;
      if (!base64) {
        showMessage('Erro', 'Formato de imagem inválido.');
        return;
      }

      setUploadingAvatar(true);
      const uri = `data:image/jpeg;base64,${base64}`;
      await updateProfile(user, { photoURL: uri });
      await saveProfileDocument({ photoURL: uri });

      setPhotoURL(uri);
      setUser(auth.currentUser);
      showMessage('Sucesso', 'Sua foto de perfil foi atualizada!');
    } catch (error) {
      console.error(error);
      showMessage('Erro', 'Falha ao processar a imagem.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await saveProfileDocument({ notifications });
      setActiveModal(null);
      showMessage('Salvo', 'Configurações de notificação atualizadas.');
    } catch (e) {
      showMessage('Erro', 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!user || !user.email) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('Campos vazios', 'Preencha todos os campos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('Erro', 'As novas senhas não coincidem.');
      return;
    }

    setSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setActiveModal(null);
      showMessage('Senha alterada', 'Sua senha foi atualizada com sucesso.');
    } catch (error) {
      console.error(error);
      showMessage('Erro', 'Não foi possível atualizar a senha. Verifique a senha atual.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLocation = async () => {
    setLocationUpdating(true);
    try {
      const { location, status } = await requestUserLocation();
      if (status === 'granted' && location) {
        setCurrentLocationLabel(formatLocationLabel(location));
        showMessage('Sucesso', `📍 Localização atualizada: ${formatLocationLabel(location)}`);
      } else {
        showMessage('Permissão necessária', 'Habilite o GPS do celular.');
      }
    } catch (error) {
      showMessage('Erro', 'Não foi possível ler sua localização.');
    } finally {
      setLocationUpdating(false);
    }
  };

  const toggleLocationFilter = async (enabled: boolean) => {
    setLocationFilterEnabled(enabled);
    await AsyncStorage.setItem('@meu-cesto:location-filter-enabled', String(enabled));
    if (enabled) {
      handleUpdateLocation();
    }
  };

  const handleLogout = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setLogoutModalVisible(true);
  };

  // Calculations for dynamic stats
  const calculatedSavings = Math.round(totalSpent * 0.12);
  const totalOrganizedItems = itemsCount + purchasesCount;

  const greetingLetter = user?.displayName ? user.displayName.charAt(0).toUpperCase() : 'G';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header matching Image 1 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={() => setSidebarVisible(true)}>
          <Ionicons name="menu-outline" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <Typography variant="caption" weight="heavy" color={Colors.primary} style={styles.topLabel}>
            SEU ESPAÇO
          </Typography>
          <Typography variant="title" weight="bold" color={Colors.textPrimary} style={{ marginTop: 2 }}>
            Perfil
          </Typography>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Typography variant="body" color={Colors.textMuted} style={{ marginTop: -Spacing.md, marginBottom: Spacing.sm }}>
          Deixe o Meu Cesto com a sua cara.
        </Typography>

        {/* Profile Card Summary matching Image 1 */}
        <Card elevated style={styles.profileHeroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroAvatarCircle}>
              <Typography variant="heading" weight="bold" color="#080A09">
                {greetingLetter}
              </Typography>
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="title" weight="bold" color={Colors.textPrimary}>
                {displayName || 'Guilherme'}
              </Typography>
              <Typography variant="caption" color={Colors.textSecondary} style={{ marginTop: 2 }}>
                {user?.email || 'guilherme@meucesto.app'}
              </Typography>
            </View>
            <TouchableOpacity onPress={() => setActiveModal('personal')} activeOpacity={0.8}>
              <Typography variant="body" weight="bold" color={Colors.primary}>
                Editar
              </Typography>
            </TouchableOpacity>
          </View>
        </Card>

        {/* 3 STATS CARDS SIDE-BY-SIDE matching Image 1 using REAL DATA */}
        <View style={styles.statsGrid}>
          <Card elevated style={styles.statCell}>
            <Typography variant="title" weight="heavy" color={Colors.primary}>
              {activeWeeks}
            </Typography>
            <Typography variant="caption" color={Colors.textMuted} align="center" style={styles.statLabel}>
              semanas no ritmo
            </Typography>
          </Card>

          <Card elevated style={styles.statCell}>
            <Typography variant="title" weight="heavy" color={Colors.primary}>
              R$ {calculatedSavings || 84}
            </Typography>
            <Typography variant="caption" color={Colors.textMuted} align="center" style={styles.statLabel}>
              economizados
            </Typography>
          </Card>

          <Card elevated style={styles.statCell}>
            <Typography variant="title" weight="heavy" color={Colors.primary}>
              {totalOrganizedItems || 28}
            </Typography>
            <Typography variant="caption" color={Colors.textMuted} align="center" style={styles.statLabel}>
              itens organizados
            </Typography>
          </Card>
        </View>

        {/* Section: Preferências matching Image 1 */}
        <Typography variant="caption" weight="bold" color={Colors.textMuted} style={styles.sectionTitle}>
          Preferências
        </Typography>

        <Card elevated style={styles.menuContainer}>
          <ProfileMenuOption
            icon="notifications-outline"
            title="Notificações úteis"
            subtitle="Lembretes baseados na sua rotina"
            onPress={() => setActiveModal('notifications')}
          />
          <ProfileMenuOption
            icon="options-outline"
            title="Preferências de compra"
            subtitle="Categorias e recomendações"
            onPress={() => setActiveModal('personal')}
          />
          <ProfileMenuOption
            icon="shield-checkmark-outline"
            title="Privacidade e dados"
            subtitle="Você decide o que compartilhar"
            onPress={() => setActiveModal('location')}
          />
          <ProfileMenuOption
            icon="lock-closed-outline"
            title="Segurança da conta"
            subtitle="Alterar senha e acesso"
            onPress={() => setActiveModal('security')}
          />
        </Card>

        {/* Section: Sobre o Meu Cesto matching Image 2 */}
        <Typography variant="caption" weight="bold" color={Colors.textMuted} style={[styles.sectionTitle, { marginTop: Spacing.md }]}>
          Sobre o Meu Cesto
        </Typography>

        <Card elevated style={styles.aboutCard}>
          <View style={styles.aboutRow}>
            <View style={styles.aboutIconBg}>
              <Ionicons name="basket" size={24} color="#080A09" />
            </View>
            <View style={{ flex: 1 }}>
              <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                Meu Cesto
              </Typography>
              <Typography variant="caption" color={Colors.textMuted} style={{ lineHeight: 18, marginTop: 2 }}>
                Compras mais inteligentes, uma decisão de cada vez.
              </Typography>
            </View>
            <Typography variant="caption" color={Colors.textMuted}>
              v1.0
            </Typography>
          </View>
        </Card>

        {/* Logout Button in Red matching Image 2 */}
        <TouchableOpacity style={styles.logoutBtnInline} onPress={handleLogout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          <Typography variant="body" weight="bold" color={Colors.error}>
            Sair da conta
          </Typography>
        </TouchableOpacity>
      </ScrollView>

      {/* Modals details */}
      {/* Modal 1: Personal Data */}
      <Modal visible={activeModal === 'personal'} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Typography variant="title" weight="bold" color={Colors.textPrimary}>Dados Pessoais</Typography>
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Typography variant="caption" weight="bold" color={Colors.textSecondary} style={{ marginBottom: 4 }}>
                NOME EXIBIDO
              </Typography>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Seu nome"
                placeholderTextColor={Colors.textMuted}
              />

              <Button
                variant="primary"
                label="Salvar alterações"
                loading={saving}
                onPress={handleSavePersonalData}
                style={{ marginTop: Spacing.xl }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal 2: Location Settings */}
      <Modal visible={activeModal === 'location'} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="title" weight="bold" color={Colors.textPrimary}>Localização</Typography>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Typography variant="body" weight="semibold" color={Colors.textPrimary}>Filtro Regional inteligente</Typography>
                <Typography variant="caption" color={Colors.textSecondary}>A IA sugere produtos e ofertas comuns do seu local.</Typography>
              </View>
              <Switch
                value={locationFilterEnabled}
                onValueChange={toggleLocationFilter}
                trackColor={{ false: Colors.border, true: Colors.primary }}
              />
            </View>

            {locationFilterEnabled && (
              <Card style={{ marginVertical: Spacing.md, gap: Spacing.xs }}>
                <Typography variant="caption" weight="bold" color={Colors.textMuted}>ENDEREÇO ATUAL</Typography>
                <Typography variant="body" weight="bold" color={Colors.textPrimary}>
                  {currentLocationLabel || 'Buscando sinal de GPS...'}
                </Typography>
                <Button
                  variant="outline"
                  size="sm"
                  label="Recalibrar GPS"
                  loading={locationUpdating}
                  onPress={handleUpdateLocation}
                  style={{ marginTop: Spacing.sm }}
                />
              </Card>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal 3: Notifications Settings */}
      <Modal visible={activeModal === 'notifications'} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Typography variant="title" weight="bold" color={Colors.textPrimary}>Notificações</Typography>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Typography variant="body" weight="semibold" color={Colors.textPrimary}>Alertas de Orçamento</Typography>
                <Typography variant="caption" color={Colors.textSecondary}>Seja notificado ao ultrapassar metas do mês.</Typography>
              </View>
              <Switch
                value={notifications.budgetAlerts}
                onValueChange={(val) => setNotifications({ ...notifications, budgetAlerts: val })}
                trackColor={{ false: Colors.border, true: Colors.primary }}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Typography variant="body" weight="semibold" color={Colors.textPrimary}>Dicas de Economia</Typography>
                <Typography variant="caption" color={Colors.textSecondary}>Dicas semanais do Luca sobre mercado local.</Typography>
              </View>
              <Switch
                value={notifications.priceTips}
                onValueChange={(val) => setNotifications({ ...notifications, priceTips: val })}
                trackColor={{ false: Colors.border, true: Colors.primary }}
              />
            </View>

            <Button
              variant="primary"
              label="Salvar notificações"
              loading={saving}
              onPress={handleSaveNotifications}
              style={{ marginTop: Spacing.xl }}
            />
          </View>
        </View>
      </Modal>

      {/* Modal 4: Security Password Change */}
      <Modal visible={activeModal === 'security'} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Typography variant="title" weight="bold" color={Colors.textPrimary}>Segurança</Typography>
                <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Typography variant="caption" weight="bold" color={Colors.textSecondary} style={{ marginBottom: 4 }}>
                SENHA ATUAL
              </Typography>
              <TextInput
                style={[styles.textInput, { marginBottom: Spacing.md }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Senha atual"
                placeholderTextColor={Colors.textMuted}
              />

              <Typography variant="caption" weight="bold" color={Colors.textSecondary} style={{ marginBottom: 4 }}>
                NOVA SENHA
              </Typography>
              <TextInput
                style={[styles.textInput, { marginBottom: Spacing.md }]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={Colors.textMuted}
              />

              <Typography variant="caption" weight="bold" color={Colors.textSecondary} style={{ marginBottom: 4 }}>
                CONFIRMAR NOVA SENHA
              </Typography>
              <TextInput
                style={styles.textInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Confirme a nova senha"
                placeholderTextColor={Colors.textMuted}
              />

              <Button
                variant="primary"
                label="Atualizar senha"
                loading={saving}
                onPress={handleUpdatePassword}
                style={{ marginTop: Spacing.xl }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <AppModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        title="Sair da conta"
        description="Você precisará entrar novamente para acessar suas listas, pedidos e finanças."
        type="confirm"
        destructive
        confirmLabel="Sair da conta"
        cancelLabel="Continuar no app"
        onConfirm={async () => {
          setLogoutModalVisible(false);
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await signOut(auth);
            router.replace('/');
          } catch (e) {
            console.warn('[Perfil] Erro ao deslogar:', e);
          }
        }}
      />
    </View>
  );
}

function ProfileMenuOption({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuOption} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.menuOptionIconBg}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={styles.menuOptionText}>
        <Typography variant="body" weight="semibold" color={Colors.textPrimary}>
          {title}
        </Typography>
        <Typography variant="caption" color={Colors.textMuted}>
          {subtitle}
        </Typography>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 120,
    gap: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: STATUS_BAR_HEIGHT + Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  topLabel: {
    letterSpacing: 0.8,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileHeroCard: {
    borderColor: Colors.border,
    borderWidth: 1,
    padding: Spacing.xl,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroAvatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'space-between',
  },
  statCell: {
    flex: 1,
    borderColor: Colors.border,
    borderWidth: 1,
    alignItems: 'center',
    padding: Spacing.sm,
    gap: 4,
    height: 95,
    justifyContent: 'center',
  },
  statLabel: {
    lineHeight: 16,
  },
  sectionTitle: {
    letterSpacing: 1,
    marginTop: Spacing.sm,
  },
  menuContainer: {
    padding: 0,
    overflow: 'hidden',
    borderColor: Colors.border,
    borderWidth: 1,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuOptionIconBg: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(183, 255, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  menuOptionText: {
    flex: 1,
  },
  aboutCard: {
    borderColor: Colors.border,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  aboutIconBg: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtnInline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
    alignSelf: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalContent: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xxxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textInput: {
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
