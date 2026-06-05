import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AUTH_MIN_PASSWORD_LENGTH, AUTH_PRIMARY_GREEN, AUTH_TEXT_GRAY } from './authTheme';

type PasswordRequirementsProps = {
  password: string;
  confirmPassword?: string;
  compact?: boolean;
};

type Rule = {
  id: string;
  label: string;
  met: boolean;
};

export function PasswordRequirements({ password, confirmPassword, compact }: PasswordRequirementsProps) {
  const rules = useMemo<Rule[]>(() => {
    const items: Rule[] = [
      {
        id: 'length',
        label: `Mínimo ${AUTH_MIN_PASSWORD_LENGTH} caracteres`,
        met: password.length >= AUTH_MIN_PASSWORD_LENGTH,
      },
    ];

    if (confirmPassword !== undefined) {
      items.push({
        id: 'match',
        label: 'Senhas coincidem',
        met: password.length > 0 && password === confirmPassword,
      });
    }

    return items;
  }, [confirmPassword, password]);

  const show = password.length > 0 || (confirmPassword?.length ?? 0) > 0;
  if (!show) return null;

  return (
    <View style={[styles.box, compact && styles.boxCompact]}>
      {rules.map((rule) => (
        <View key={rule.id} style={styles.row}>
          <Ionicons
            name={rule.met ? 'checkmark-circle' : 'ellipse-outline'}
            size={compact ? 16 : 18}
            color={rule.met ? AUTH_PRIMARY_GREEN : AUTH_TEXT_GRAY}
          />
          <Text style={[styles.text, compact && styles.textCompact, rule.met && styles.textMet]}>
            {rule.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function isPasswordValid(password: string, confirmPassword?: string) {
  if (password.length < AUTH_MIN_PASSWORD_LENGTH) return false;
  if (confirmPassword !== undefined && password !== confirmPassword) return false;
  return true;
}

const styles = StyleSheet.create({
  box: {
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F7F7F7',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    gap: 8,
  },
  boxCompact: {
    paddingVertical: 10,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 13,
    color: AUTH_TEXT_GRAY,
    fontWeight: '600',
  },
  textCompact: {
    fontSize: 12,
  },
  textMet: {
    color: '#4A4A4A',
  },
});
