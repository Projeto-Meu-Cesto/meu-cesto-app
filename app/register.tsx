import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { AuthAnimatedInput } from '../components/auth/AuthAnimatedInput';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { isPasswordValid, PasswordRequirements } from '../components/auth/PasswordRequirements';
import {
  AUTH_BUTTON_GRAY,
  AUTH_MIN_PASSWORD_LENGTH,
  AUTH_PRIMARY_GREEN,
  AUTH_TEXT_GRAY,
} from '../components/auth/authTheme';
import { useAuthLayout } from '../components/auth/useAuthLayout';
import { requestAppTourSession } from '../context/tourSession';
import { useToast } from '../context/ToastContext';
import { auth, isFirebaseConfigured } from '../scripts/firebaseConfig';
import { markAppTourPending } from '../scripts/tourStorage';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const layout = useAuthLayout();

  const handleRegister = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      showToast('Preencha todos os campos', 'info');
      return;
    }

    if (cleanName.length < 2) {
      showToast('Digite seu nome completo', 'info');
      return;
    }

    if (!isPasswordValid(password, confirmPassword)) {
      if (password.length < AUTH_MIN_PASSWORD_LENGTH) {
        showToast(`A senha deve ter pelo menos ${AUTH_MIN_PASSWORD_LENGTH} caracteres`, 'info');
      } else {
        showToast('As senhas não coincidem', 'error');
      }
      return;
    }

    if (!isFirebaseConfigured) {
      showToast('Firebase não configurado neste ambiente.', 'error');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const { uid } = userCredential.user;
      requestAppTourSession(uid);
      await markAppTourPending(uid);
      await updateProfile(userCredential.user, {
        displayName: cleanName,
      });
      showToast('Conta criada com sucesso!', 'success');
    } catch (error: unknown) {
      console.error('Erro de registro:', error);
      let errorMessage = 'Não foi possível criar sua conta.';
      const code = (error as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') {
        errorMessage = 'Este e-mail já está em uso.';
      } else if (code === 'auth/invalid-email') {
        errorMessage = 'E-mail inválido.';
      } else if (code === 'auth/weak-password') {
        errorMessage = `A senha deve ter pelo menos ${AUTH_MIN_PASSWORD_LENGTH} caracteres.`;
      }
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    name.trim().length >= 2 &&
    email.trim().length > 0 &&
    isPasswordValid(password, confirmPassword);

  return (
    <AuthScreenShell>
      <View style={[styles.page, { maxWidth: layout.maxFormWidth, width: '100%', alignSelf: 'center' }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Ionicons name="arrow-back" size={26} color={AUTH_PRIMARY_GREEN} />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={[styles.title, { fontSize: layout.titleFontSize }]}>Criar conta</Text>
          <Text style={[styles.subtitle, { fontSize: layout.subtitleFontSize }]}>
            Comece a organizar suas finanças hoje mesmo
          </Text>
        </View>

        <View style={styles.formCard}>
          <AuthAnimatedInput
            label="Nome completo"
            icon="person-outline"
            value={name}
            onChangeText={setName}
            placeholder="Seu nome"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            inputHeight={layout.inputHeight}
            labelFontSize={layout.labelFontSize}
            inputFontSize={layout.inputFontSize}
          />

          <View style={{ height: layout.formGap }} />

          <AuthAnimatedInput
            label="E-mail"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            inputHeight={layout.inputHeight}
            labelFontSize={layout.labelFontSize}
            inputFontSize={layout.inputFontSize}
          />

          <View style={{ height: layout.formGap }} />

          <AuthAnimatedInput
            label="Senha"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder={`Mínimo ${AUTH_MIN_PASSWORD_LENGTH} caracteres`}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            inputHeight={layout.inputHeight}
            labelFontSize={layout.labelFontSize}
            inputFontSize={layout.inputFontSize}
          />

          <PasswordRequirements
            password={password}
            confirmPassword={confirmPassword}
            compact={layout.width < 360}
          />

          <View style={{ height: layout.formGap }} />

          <AuthAnimatedInput
            label="Confirmar senha"
            icon="checkmark-circle-outline"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repita sua senha"
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            inputHeight={layout.inputHeight}
            labelFontSize={layout.labelFontSize}
            inputFontSize={layout.inputFontSize}
          />

          <Pressable
            onPress={handleRegister}
            disabled={loading || !isFormValid}
            style={({ pressed }) => [
              styles.button,
              { height: layout.buttonHeight, borderRadius: layout.buttonHeight / 2, marginTop: layout.formGap + 4 },
              isFormValid && !loading ? styles.buttonActive : styles.buttonInactive,
              pressed && !loading && isFormValid && styles.buttonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.buttonText}>Criar conta</Text>
                <Ionicons name="person-add-outline" size={20} color="#fff" style={styles.buttonIcon} />
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem uma conta? </Text>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Text style={styles.footerLink}>Entrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  page: {
    width: '100%',
  },
  headerRow: {
    marginBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginLeft: -8,
  },
  hero: {
    marginBottom: 22,
  },
  title: {
    fontWeight: '900',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    color: AUTH_TEXT_GRAY,
    lineHeight: 22,
  },
  formCard: {
    width: '100%',
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  button: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonActive: {
    backgroundColor: AUTH_PRIMARY_GREEN,
  },
  buttonInactive: {
    backgroundColor: AUTH_BUTTON_GRAY,
    shadowOpacity: 0.06,
    elevation: 0,
  },
  buttonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginTop: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 28,
    paddingHorizontal: 4,
  },
  footerText: {
    color: AUTH_TEXT_GRAY,
    fontSize: 15,
  },
  footerLink: {
    color: AUTH_PRIMARY_GREEN,
    fontSize: 15,
    fontWeight: '800',
  },
});
