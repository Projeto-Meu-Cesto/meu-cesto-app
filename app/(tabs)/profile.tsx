import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
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
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '../../scripts/firebaseConfig';
import { formatLocationLabel, getCachedLocation, requestUserLocation } from '../../scripts/locationService';

const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';
const DANGER = '#EF4444';

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
        // Load location filter preference
        const enabledRaw = await AsyncStorage.getItem('@meu-cesto:location-filter-enabled');
        setLocationFilterEnabled(enabledRaw === null ? true : enabledRaw === 'true');

        // Load cached location label
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
        quality: 0.35, // Keep file size small for Firestore limit
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploadingAvatar(true);

      const selected = result.assets[0];
      let base64Data = selected.base64;

      if (!base64Data) {
        // Fallback to fetch and FileReader if base64 is not populated
        const response = await fetch(selected.uri);
        const blob = await response.blob();
        base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const resultStr = reader.result as string;
            const base64Str = resultStr.split(',')[1] || resultStr;
            resolve(base64Str);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const mimeType = selected.mimeType || 'image/jpeg';
      const base64PhotoURL = `data:${mimeType};base64,${base64Data}`;

      const profileName = displayName.trim() || user.displayName || '';

      // Try updating Auth profile. (Fallback if base64 string is too long for Auth photoURL limit)
      try {
        await updateProfile(user, { displayName: profileName, photoURL: base64PhotoURL });
      } catch (authErr) {
        console.warn('[Perfil] Não foi possível atualizar fotoURL no Firebase Auth (tamanho limite excedido):', authErr);
        await updateProfile(user, { displayName: profileName });
      }

      await saveProfileDocument({ displayName: profileName, photoURL: base64PhotoURL });

      setDisplayName(profileName);
      setPhotoURL(base64PhotoURL);
      setUser(auth.currentUser);
      showMessage('Foto atualizada', 'Seu avatar foi salvo com sucesso no Firestore.');
    } catch (error) {
      console.error('[Perfil] Erro ao salvar avatar:', error);
      showMessage('Erro no avatar', 'Não consegui salvar a foto no Firestore.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (Platform.OS === 'web') {
      showMessage('Notificações', 'Notificações nativas não são suportadas no navegador web.');
      return;
    }

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        showMessage('Permissão necessária', 'Habilite as notificações nas configurações do seu celular para receber alertas.');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Meu Cesto 🛒',
          body: 'Esta é uma notificação de teste! Suas notificações estão funcionando perfeitamente.',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    } catch (error) {
      console.error('[Perfil] Erro ao enviar notificação de teste:', error);
      showMessage('Erro', 'Ocorreu um erro ao tentar enviar a notificação.');
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      await saveProfileDocument({ notifications });
      setActiveModal(null);
      showMessage('Notificações salvas', 'Suas preferências foram atualizadas.');
    } catch (error) {
      console.error('[Perfil] Erro ao salvar notificações:', error);
      showMessage('Erro', 'Não foi possível salvar as preferências de notificação.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user?.email) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showMessage('Campos obrigatórios', 'Preencha a senha atual, a nova senha e a confirmação.');
      return;
    }

    if (newPassword.length < 6) {
      showMessage('Senha fraca', 'A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('Confirmação incorreta', 'A confirmação precisa ser igual à nova senha.');
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
      showMessage('Senha alterada', 'Sua senha foi atualizada com segurança.');
    } catch (error: any) {
      console.error('[Perfil] Erro ao alterar senha:', error);
      const message = error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password'
        ? 'A senha atual está incorreta.'
        : 'Não foi possível alterar a senha agora.';
      showMessage('Erro de segurança', message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/');
    } catch {
      showMessage('Erro', 'Não foi possível sair da sessão.');
    }
  };

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = typeof window === 'undefined' ? true : window.confirm('Deseja realmente encerrar sua sessão?');
      if (confirmed) handleLogout();
      return;
    }

    Alert.alert(
      'Sair',
      'Deseja realmente encerrar sua sessão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: handleLogout },
      ]
    );
  };

  const openSupportEmail = () => {
    const subject = encodeURIComponent('Suporte Meu Cesto');
    const body = encodeURIComponent(`Olá, preciso de ajuda com o Meu Cesto.\n\nConta: ${user?.email || ''}`);
    Linking.openURL(`mailto:suporte@meucesto.app?subject=${subject}&body=${body}`).catch(() => {
      showMessage('Suporte', 'Envie um e-mail para suporte@meucesto.app.');
    });
  };

  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleLocationFilter = async () => {
    const nextVal = !locationFilterEnabled;
    setLocationFilterEnabled(nextVal);
    await AsyncStorage.setItem('@meu-cesto:location-filter-enabled', String(nextVal));
  };

  const handleForceLocationUpdate = async () => {
    setLocationUpdating(true);
    const { location, status } = await requestUserLocation();
    setLocationUpdating(false);
    if (status === 'granted' && location) {
      setCurrentLocationLabel(formatLocationLabel(location));
      showMessage('Localização atualizada', `Seu local foi definido como ${formatLocationLabel(location)}.`);
    } else if (status === 'denied') {
      Alert.alert(
        'Permissão necessária',
        'Não foi possível buscar a localização. Caso o acesso tenha sido negado no dispositivo, você pode habilitá-lo nas configurações.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Configurações', onPress: () => Linking.openSettings() }
        ]
      );
    } else {
      showMessage('Erro', 'A localização está indisponível no momento.');
    }
  };

  if (!authReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={PRIMARY_GREEN} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Perfil</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={50} color={PRIMARY_GREEN} />
              )}
            </View>
            <TouchableOpacity style={styles.editButton} onPress={handlePickAvatar} disabled={uploadingAvatar}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.userName}>{displayName || user?.displayName || 'Usuário'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'email@exemplo.com'}</Text>
        </View>

        <View style={styles.menuCard}>
          <MenuItem icon="person-outline" title="Dados Pessoais" onPress={() => setActiveModal('personal')} />
          <MenuItem icon="notifications-outline" title="Notificações" onPress={() => setActiveModal('notifications')} />
          <MenuItem icon="location-outline" title="Filtro por Localização" onPress={() => setActiveModal('location')} />
          <MenuItem icon="shield-checkmark-outline" title="Segurança" onPress={() => setActiveModal('security')} />
          <MenuItem icon="help-circle-outline" title="Ajuda & Suporte" onPress={() => setActiveModal('help')} />
          <MenuItem
            icon="log-out-outline"
            title="Sair"
            color={DANGER}
            isLast
            onPress={confirmLogout}
          />
        </View>

        <Text style={styles.versionText}>Versão 1.0.2 (Beta)</Text>
      </ScrollView>

      <ModalShell visible={activeModal === 'personal'} title="Dados pessoais" onClose={closeModal}>
        <Text style={styles.fieldLabel}>Nome completo</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Seu nome"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.fieldLabel}>E-mail</Text>
        <View style={styles.readonlyField}>
          <Text style={styles.readonlyText}>{user?.email || 'Sem e-mail'}</Text>
          <Ionicons name="lock-closed-outline" size={16} color={TEXT_GRAY} />
        </View>
        <Text style={styles.helpText}>O e-mail é usado no login. Para trocar, peça suporte ou crie uma nova conta.</Text>

        <PrimaryButton title="Salvar dados" loading={saving} onPress={handleSavePersonalData} />
      </ModalShell>

      <ModalShell visible={activeModal === 'notifications'} title="Notificações" onClose={closeModal}>
        <SettingToggle
          title="Alertas de orçamento"
          description="Avisar quando seus gastos do mês ficarem acima do esperado."
          value={notifications.budgetAlerts}
          onPress={() => toggleNotification('budgetAlerts')}
        />
        <SettingToggle
          title="Dicas de economia"
          description="Receber sugestões sobre compras e substituições mais baratas."
          value={notifications.priceTips}
          onPress={() => toggleNotification('priceTips')}
        />
        <SettingToggle
          title="Resumo semanal"
          description="Mostrar um resumo dos gastos e itens mais comprados na semana."
          value={notifications.weeklySummary}
          onPress={() => toggleNotification('weeklySummary')}
        />

        <TouchableOpacity style={styles.testNotificationButton} onPress={handleSendTestNotification}>
          <Ionicons name="notifications-outline" size={18} color={PRIMARY_GREEN} />
          <Text style={styles.testNotificationButtonText}>Enviar Notificação de Teste</Text>
        </TouchableOpacity>

        <PrimaryButton title="Salvar notificações" loading={saving} onPress={handleSaveNotifications} />
      </ModalShell>

      <ModalShell visible={activeModal === 'location'} title="Filtro por Localização" onClose={closeModal}>
        <SettingToggle
          title="Filtro regional inteligente"
          description="Prioriza marcas regionais, ofertas típicas e ajusta o buscador com base na sua localização."
          value={locationFilterEnabled}
          onPress={toggleLocationFilter}
        />

        {locationFilterEnabled && (
          <View style={styles.locationStatusBox}>
            <Ionicons name="location" size={20} color={PRIMARY_GREEN} />
            <View style={{ flex: 1 }}>
              <Text style={styles.locationStatusTitle}>Localização atual</Text>
              <Text style={styles.locationStatusText}>
                {currentLocationLabel || 'Nenhuma localização detectada'}
              </Text>
            </View>
          </View>
        )}

        {locationFilterEnabled && (
          <TouchableOpacity style={styles.testNotificationButton} onPress={handleForceLocationUpdate} disabled={locationUpdating}>
            {locationUpdating ? (
              <ActivityIndicator size="small" color={PRIMARY_GREEN} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color={PRIMARY_GREEN} />
                <Text style={styles.testNotificationButtonText}>Atualizar Localização</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ModalShell>

      <ModalShell visible={activeModal === 'security'} title="Segurança" onClose={closeModal}>
        <View style={styles.securityCard}>
          <View style={styles.securityIcon}>
            <Ionicons name="shield-checkmark" size={24} color={PRIMARY_GREEN} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Conta protegida por Firebase Auth</Text>
            <Text style={styles.securityText}>Para alterar a senha, confirme sua senha atual.</Text>
          </View>
        </View>

        <Text style={styles.fieldLabel}>Senha atual</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Digite sua senha atual"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />

        <Text style={styles.fieldLabel}>Nova senha</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />

        <Text style={styles.fieldLabel}>Confirmar nova senha</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Repita a nova senha"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />

        <PrimaryButton title="Alterar senha" loading={saving} onPress={handleChangePassword} />
      </ModalShell>

      <ModalShell visible={activeModal === 'help'} title="Ajuda & Suporte" onClose={closeModal}>
        <HelpItem
          icon="cart-outline"
          title="Como registrar gastos?"
          description="Adicione itens na lista e informe preço. O dashboard e o Luca usam esses valores para analisar o mês."
        />
        <HelpItem
          icon="sparkles-outline"
          title="Como o Luca usa meus dados?"
          description="Ele lê apenas os dados salvos na sua conta: lista, gastos, categorias e histórico mensal."
        />
        <HelpItem
          icon="cloud-outline"
          title="Meus dados ficam salvos?"
          description="Sim. Listas, preferências e histórico do Luca ficam no Firebase, separados pelo seu usuário."
        />

        <TouchableOpacity style={styles.supportButton} onPress={openSupportEmail}>
          <Ionicons name="mail-outline" size={18} color={PRIMARY_GREEN} />
          <Text style={styles.supportButtonText}>Falar com suporte</Text>
        </TouchableOpacity>
      </ModalShell>
    </View>
  );
}

function ModalShell({
  visible,
  title,
  children,
  onClose,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  const sheetTranslateY = React.useRef(new Animated.Value(36)).current;

  useEffect(() => {
    if (!visible) return;

    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(36);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        damping: 18,
        stiffness: 220,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, sheetTranslateY, visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.modalBackdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.modalBackdropPressable} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.modalSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={22} color={TEXT_DARK} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalContent}>
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MenuItem({
  icon,
  title,
  color = TEXT_DARK,
  isLast = false,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  color?: string;
  isLast?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, isLast && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.menuIconWrapper, { backgroundColor: color === DANGER ? '#FEE2E2' : '#F1F5F9' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.menuItemText, { color }]}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

function PrimaryButton({ title, loading, onPress }: { title: string; loading: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.primaryButton, loading && styles.primaryButtonDisabled]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{title}</Text>}
    </TouchableOpacity>
  );
}

function SettingToggle({
  title,
  description,
  value,
  onPress,
}: {
  title: string;
  description: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <TouchableOpacity style={styles.toggleTextContent} onPress={onPress} activeOpacity={0.8}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </TouchableOpacity>
      <Switch
        value={value}
        onValueChange={onPress}
        trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
        thumbColor={value ? PRIMARY_GREEN : '#F8FAFC'}
      />
    </View>
  );
}

function HelpItem({
  icon,
  title,
  description,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
}) {
  return (
    <View style={styles.helpItem}>
      <View style={styles.helpIcon}>
        <Ionicons name={icon} size={20} color={PRIMARY_GREEN} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.helpTitle}>{title}</Text>
        <Text style={styles.helpDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG_LIGHT,
  },
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingHorizontal: 25,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 14 : 64,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 120,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 35,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 15,
  },
  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: PRIMARY_GREEN,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: BG_LIGHT,
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_DARK,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: 14,
    color: TEXT_GRAY,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  menuCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 30,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalBackdropPressable: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxHeight: '88%',
    paddingHorizontal: 22,
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BG_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    paddingBottom: 32,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_GRAY,
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    height: 54,
    borderRadius: 16,
    backgroundColor: BG_LIGHT,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: '700',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  readonlyField: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readonlyText: {
    color: TEXT_GRAY,
    fontSize: 15,
    fontWeight: '700',
  },
  helpText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 8,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  toggleTextContent: {
    flex: 1,
  },
  toggleTitle: {
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: '900',
  },
  toggleDescription: {
    color: TEXT_GRAY,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 4,
  },
  securityCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginBottom: 8,
  },
  securityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTitle: {
    color: TEXT_DARK,
    fontSize: 14,
    fontWeight: '900',
  },
  securityText: {
    color: TEXT_GRAY,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 3,
  },
  helpItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpTitle: {
    color: TEXT_DARK,
    fontSize: 15,
    fontWeight: '900',
  },
  helpDescription: {
    color: TEXT_GRAY,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginTop: 4,
  },
  supportButton: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  supportButtonText: {
    color: PRIMARY_GREEN,
    fontSize: 15,
    fontWeight: '900',
  },
  testNotificationButton: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 15,
    marginBottom: 5,
  },
  testNotificationButtonText: {
    color: PRIMARY_GREEN,
    fontSize: 15,
    fontWeight: '900',
  },
  locationStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
    marginBottom: 5,
  },
  locationStatusTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: TEXT_DARK,
    marginBottom: 2,
  },
  locationStatusText: {
    fontSize: 14,
    color: TEXT_GRAY,
    fontWeight: '700',
  },
});
