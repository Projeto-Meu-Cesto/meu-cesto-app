import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AuthAnimatedInput } from '../components/auth/AuthAnimatedInput';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import {
  AUTH_BUTTON_GRAY,
  AUTH_MIN_PASSWORD_LENGTH,
  AUTH_PRIMARY_GREEN,
  AUTH_TEXT_GRAY,
} from '../components/auth/authTheme';
import { useAuthLayout } from '../components/auth/useAuthLayout';
import { useToast } from '../context/ToastContext';
import { auth, isFirebaseConfigured } from '../scripts/firebaseConfig';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();
  const layout = useAuthLayout();

  const logoScale = useSharedValue(1);

  useEffect(() => {
    logoScale.value = withRepeat(
      withSequence(withTiming(1.03, { duration: 2500 }), withTiming(1, { duration: 2500 })),
      -1,
      true
    );
  }, [logoScale]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showToast('Preencha todos os campos', 'info');
      return;
    }

    if (password.length < AUTH_MIN_PASSWORD_LENGTH) {
      showToast(`A senha deve ter pelo menos ${AUTH_MIN_PASSWORD_LENGTH} caracteres`, 'info');
      return;
    }

    if (!isFirebaseConfigured) {
      showToast('Firebase não configurado neste ambiente.', 'error');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      showToast('Bem-vindo de volta!', 'success');
    } catch (error: unknown) {
      console.error('Erro de login:', error);
      let errorMessage = 'E-mail ou senha incorretos.';
      const code = (error as { code?: string })?.code;
      if (code === 'auth/invalid-email') {
        errorMessage = 'E-mail inválido.';
      }
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = email.trim().length > 0 && password.length >= AUTH_MIN_PASSWORD_LENGTH;

  return (
    <AuthScreenShell centerContent>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.page, { maxWidth: layout.maxFormWidth, width: '100%', alignSelf: 'center' }]}>
        <Animated.View style={[styles.logoWrap, { marginBottom: layout.logoMarginBottom }, animatedLogoStyle]}>
          <Image
            source={require('@/assets/images/Meu-Cesto-Logo.png')}
            style={{ width: layout.logoWidth, height: layout.logoHeight }}
            contentFit="contain"
          />
        </Animated.View>

        <View style={styles.hero}>
          <Text style={[styles.title, { fontSize: layout.titleFontSize }]}>Bem-vindo de volta</Text>
          <Text style={[styles.subtitle, { fontSize: layout.subtitleFontSize }]}>
            Entre para continuar organizando suas compras
          </Text>
        </View>

        <View style={styles.formCard}>
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
            placeholder={"********"}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            inputHeight={layout.inputHeight}
            labelFontSize={layout.labelFontSize}
            inputFontSize={layout.inputFontSize}
          />

          <Pressable
            onPress={handleLogin}
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
                <Text style={styles.buttonText}>Entrar</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Não tem uma conta? </Text>
          <TouchableOpacity onPress={() => router.push('/register')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Text style={styles.footerLink}>Crie uma</Text>
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
  logoWrap: {
    width: '100%',
    alignItems: 'center',
  },
  hero: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontWeight: '900',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: AUTH_TEXT_GRAY,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  formCard: {
    width: '100%',
    padding: 10,
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
