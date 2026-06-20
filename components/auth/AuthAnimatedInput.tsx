import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import {
  AUTH_BORDER_GRAY,
  AUTH_PRIMARY_GREEN,
  AUTH_TEXT_DARK,
  AUTH_TEXT_GRAY,
} from './authTheme';

type AuthAnimatedInputProps = TextInputProps & {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  secureTextEntry?: boolean;
  inputHeight?: number;
  labelFontSize?: number;
  inputFontSize?: number;
};

export function AuthAnimatedInput({
  label,
  icon,
  secureTextEntry,
  inputHeight = 56,
  labelFontSize = 14,
  inputFontSize = 16,
  ...textInputProps
}: AuthAnimatedInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const focusAnim = useSharedValue(0);

  useEffect(() => {
    focusAnim.value = withTiming(isFocused ? 1 : 0, { duration: 280 });
  }, [focusAnim, isFocused]);

  const animatedWrapperStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focusAnim.value, [0, 1], [AUTH_BORDER_GRAY, AUTH_PRIMARY_GREEN]),
    borderWidth: withTiming(isFocused ? 2 : 1.5),
    backgroundColor: interpolateColor(focusAnim.value, [0, 1], ['#FAFAFA', '#FFFFFF']),
    shadowOpacity: withTiming(isFocused ? 0.12 : 0.04),
    elevation: withTiming(isFocused ? 3 : 1),
  }));

  const animatedIconStyle = useAnimatedStyle(() => ({
    color: interpolateColor(focusAnim.value, [0, 1], [AUTH_TEXT_GRAY, AUTH_PRIMARY_GREEN]),
  }));

  return (
    <View style={styles.group}>
      <Text style={[styles.label, { fontSize: labelFontSize, color: isFocused ? AUTH_PRIMARY_GREEN : AUTH_TEXT_GRAY }]}>
        {label}
      </Text>
      <Animated.View style={[styles.wrapper, { height: inputHeight, borderRadius: inputHeight / 3.2 }, animatedWrapperStyle]}>
        <Animated.Text style={animatedIconStyle}>
          <Ionicons name={icon} size={21} style={styles.icon} />
        </Animated.Text>
        <TextInput
          {...textInputProps}
          style={[
            styles.input,
            { fontSize: inputFontSize },
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
            textInputProps.style,
          ]}
          placeholderTextColor="#BBBBBB"
          secureTextEntry={secureTextEntry && !showPassword}
          onFocus={(e) => {
            setIsFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            textInputProps.onBlur?.(e);
          }}
        />
        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setShowPassword((v) => !v)}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color={AUTH_TEXT_GRAY} />
          </TouchableOpacity>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    width: '100%',
  },
  label: {
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 4,
  },
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    color: AUTH_TEXT_DARK,
    fontWeight: '500',
    paddingVertical: 0,
  },
  eye: {
    padding: 6,
    marginRight: -4,
  },
});
