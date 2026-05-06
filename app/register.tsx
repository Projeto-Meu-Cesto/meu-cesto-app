import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';

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
  }, [isFocused]);

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

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();

  const handleRegister = () => {
    if (password !== confirmPassword) {
      alert('As senhas não coincidem!');
      return;
    }
    console.log('Registro com:', { name, username, password });
    router.push('/onboarding');
  };

  const isFormValid = name.length > 0 && username.length > 0 && password.length >= 6 && password === confirmPassword;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={28} color={PRIMARY_GREEN} />
            </TouchableOpacity>
          </View>

          <View style={styles.titleContainer}>
            <Text style={styles.title}>Criar Conta</Text>
            <Text style={styles.subtitle}>Comece a organizar suas finanças hoje mesmo</Text>
          </View>

          <View style={styles.formContainer}>

            <AnimatedInput
              label="Nome Completo"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              placeholder="Seu nome"
              autoCapitalize="words"
            />

            <AnimatedInput
              label="Usuário"
              icon="at-outline"
              value={username}
              onChangeText={setUsername}
              placeholder="Escolha um usuário"
            />

            <AnimatedInput
              label="Senha"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
            />

            <AnimatedInput
              label="Confirmar Senha"
              icon="checkmark-circle-outline"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repita sua senha"
              secureTextEntry
            />

            {/* Botão Cadastrar */}
            <Pressable
              onPress={handleRegister}
              style={({ pressed, hovered }) => [
                styles.button,
                (pressed || hovered || isFormValid) ? styles.buttonActive : styles.buttonInactive,
                { transform: [{ scale: pressed ? 0.96 : 1 }] }
              ]}
            >
              <Text style={styles.buttonText}>Criar Conta</Text>
            </Pressable>

            {/* Link de Login */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>já tem uma conta? </Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.footerLink}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingTop: 20,
    paddingBottom: 40,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginLeft: -10,
  },
  logoMiniContainer: {
    paddingRight: 10,
  },
  logoMini: {
    width: 100,
    height: 50,
  },
  titleContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: TEXT_GRAY,
    lineHeight: 22,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 15,
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: '#FAFAFA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 4,
  },
  button: {
    height: 56,
    borderRadius: 28,
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
    marginTop: 30,
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
});
