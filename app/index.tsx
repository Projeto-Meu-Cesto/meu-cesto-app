import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
  withRepeat,
  withSequence,
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

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

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
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const handleLogin = () => {
    console.log('Login com:', username, password);
    router.push('/onboarding');
  };

  const isFormValid = username.length > 0 && password.length >= 6;

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
          <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
            <Image
              source={require('@/assets/images/Meu-Cesto-Logo.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </Animated.View>

          <View style={styles.formContainer}>

            <AnimatedInput
              label="Usuário"
              icon="person-outline"
              value={username}
              onChangeText={setUsername}
              placeholder="Seu usuário"
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
              style={({ pressed, hovered }) => [
                styles.button,
                (pressed || hovered || isFormValid) ? styles.buttonActive : styles.buttonInactive,
                { transform: [{ scale: pressed ? 0.96 : 1 }] }
              ]}
            >
              <Text style={styles.buttonText}>Entrar</Text>
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
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 60,
    width: '100%',
    alignItems: 'center',
  },
  logo: {
    width: 340,
    height: 240,
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
