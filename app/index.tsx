import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useToast } from '../context/ToastContext';
import { auth, isFirebaseConfigured } from '../scripts/firebaseConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STATUS_BAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) : 44;

const PRIMARY_GREEN = '#00C853';
const TEXT_GRAY = '#757575';
const BORDER_GRAY = '#E0E0E0';
const BUTTON_GRAY = '#B0B0B0';

const AnimatedInput = ({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none' as any
}: any) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const focusAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 300 });
  }, [focusAnim, isFocused]);

  const animatedWrapperStyle = useAnimatedStyle(() => {
    return {
      borderColor: interpolateColor(
        focusAnim.value,
        [0, 1],
        [BORDER_GRAY, PRIMARY_GREEN]
      ),
      borderWidth: withTiming(isFocused ? 2 : 1.5),
      transform: [{ scale: withSpring(isFocused ? 1.02 : 1) }],
      backgroundColor: interpolateColor(
        focusAnim.value,
        [0, 1],
        ['#FAFAFA', '#FFFFFF']
      ),
      shadowOpacity: withTiming(isFocused ? 0.15 : 0),
      elevation: withTiming(isFocused ? 4 : 0),
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        focusAnim.value,
        [0, 1],
        [TEXT_GRAY, PRIMARY_GREEN]
      ),
    };
  });

  return (
    <View style={styles.inputGroup}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={[
        styles.label,
        { color: isFocused ? PRIMARY_GREEN : TEXT_GRAY }
      ]}>
        {label}
      </Text>
      <Animated.View style={[styles.inputWrapper, animatedWrapperStyle]}>
        <Animated.Text style={animatedIconStyle}>
          <Ionicons name={icon} size={22} style={styles.inputIcon} />
        </Animated.Text>

        <TextInput
          style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
          placeholder={placeholder}
          placeholderTextColor="#BBB"
          value={value}
          onChangeText={onChangeText}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={TEXT_GRAY}
            />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { showToast } = useToast();

  const logoScale = useSharedValue(1);

  useEffect(() => {
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.03, { duration: 2500 }),
        withTiming(1, { duration: 2500 })
      ),
      -1,
      true
    );
  }, [logoScale]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const handleLogin = async () => {
    if (!email || !password) {
      showToast('Preencha todos os campos', 'info');
      return;
    }

    if (!isFirebaseConfigured) {
      showToast('Firebase não configurado neste ambiente.', 'error');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Bem-vindo de volta!', 'success');
      // Redirecionamento é feito automaticamente pelo RootLayout
    } catch (error: any) {
      console.error('Erro de login:', error);
      let errorMessage = 'E-mail ou senha incorretos.';
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'E-mail inválido.';
      }
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = email.length > 0 && password.length >= 6;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
            <Image
              source={require('@/assets/images/Meu-Cesto-Logo.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </Animated.View>

          <View style={styles.formContainer}>

            <AnimatedInput
              label="E-mail"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              autoCapitalize="none"
            />

            <AnimatedInput
              label="Senha"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Sua senha"
              secureTextEntry
            />

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => [
                styles.button,
                (pressed || (isFormValid && !loading)) ? styles.buttonActive : styles.buttonInactive,
                { transform: [{ scale: (pressed && !loading) ? 0.96 : 1 }] }
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </Pressable>



            <View style={styles.footer}>
              <Text style={styles.footerText}>não tem uma conta? </Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={styles.footerLink}>Crie uma</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: STATUS_BAR_HEIGHT + 20,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 40,
    width: '100%',
    alignItems: 'center',
  },
  logo: {
    width: Math.min(SCREEN_WIDTH * 0.8, 320),
    height: Math.min(SCREEN_WIDTH * 0.55, 200),
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 16,
    height: 60,
    backgroundColor: '#FAFAFA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  inputIcon: {
    marginRight: 16,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    paddingLeft: 4,
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonActive: {
    backgroundColor: PRIMARY_GREEN,
  },
  buttonInactive: {
    backgroundColor: BUTTON_GRAY,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: TEXT_GRAY,
    fontSize: 15,
  },
  footerLink: {
    color: PRIMARY_GREEN,
    fontSize: 15,
    fontWeight: '800',
  },
},
);
