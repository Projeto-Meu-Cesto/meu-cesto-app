import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  Alert,
} from 'react-native';
import { auth } from '../../scripts/firebaseConfig';

const PRIMARY_GREEN = '#00A36C';
const BG_LIGHT = '#F8FAFC';
const TEXT_DARK = '#1E293B';
const TEXT_GRAY = '#64748B';

export default function ProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/'); // Volta para a tela de login
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível sair da sessão.');
    }
  };

  const confirmLogout = () => {
    if (Platform.OS === 'web') {
      handleLogout();
    } else {
      Alert.alert(
        'Sair',
        'Deseja realmente encerrar sua sessão?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sair', style: 'destructive', onPress: handleLogout },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <View>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Perfil</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.profileSection}>
            <View style={styles.avatarWrapper}>
                <View style={styles.avatarCircle}>
                    <Ionicons name="person" size={50} color={PRIMARY_GREEN} />
                </View>
                <TouchableOpacity style={styles.editButton}>
                    <Ionicons name="pencil" size={16} color="#fff" />
                </TouchableOpacity>
            </View>
            <Text style={styles.userName}>{user?.displayName || 'Usuário'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'email@exemplo.com'}</Text>
        </View>

        <View style={styles.menuCard}>
          <MenuItem icon="person-outline" title="Dados Pessoais" />
          <MenuItem icon="notifications-outline" title="Notificações" />
          <MenuItem icon="shield-checkmark-outline" title="Segurança" />
          <MenuItem icon="help-circle-outline" title="Ajuda & Suporte" />
          <MenuItem 
            icon="log-out-outline" 
            title="Sair" 
            color="#EF4444" 
            isLast 
            onPress={confirmLogout}
          />
        </View>

        <Text style={styles.versionText}>Versão 1.0.2 (Beta)</Text>
      </ScrollView>
    </View>
  );
}

function MenuItem({ icon, title, color = TEXT_DARK, isLast, onPress }: any) {
  return (
    <TouchableOpacity 
      style={[styles.menuItem, isLast && { borderBottomWidth: 0 }]} 
      onPress={onPress}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.menuIconWrapper, { backgroundColor: color === '#EF4444' ? '#FEE2E2' : '#F1F5F9' }]}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[styles.menuItemText, { color: color }]}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingHorizontal: 25,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 10 : 0,
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
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  editButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: PRIMARY_GREEN,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: BG_LIGHT,
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_DARK,
  },
  userEmail: {
    fontSize: 14,
    color: TEXT_GRAY,
    fontWeight: '500',
    marginTop: 2,
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
});
