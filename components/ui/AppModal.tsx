import { Ionicons } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, Platform, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { Typography } from './Typography';
import { Button } from './Button';

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  type?: 'info' | 'success' | 'error' | 'warning' | 'confirm';
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  loading?: boolean;
  destructive?: boolean;
  dismissible?: boolean;
  testID?: string;
  children?: React.ReactNode;
}

export function AppModal({
  visible,
  onClose,
  title,
  description,
  type = 'info',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  loading = false,
  destructive = false,
  dismissible = true,
  testID,
  children,
}: AppModalProps) {
  const handleClose = () => {
    if (!loading && dismissible) onClose();
  };

  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || !dismissible || loading) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismissible, loading, onClose, visible]);

  if (!visible) return null;

  const getIconConfig = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle-outline', color: Colors.primary };
      case 'error':
        return { name: 'alert-circle-outline', color: Colors.error };
      case 'warning':
      case 'confirm':
        return { name: 'help-circle-outline', color: Colors.warning };
      default:
        return { name: 'information-circle-outline', color: Colors.primary };
    }
  };

  const icon = getIconConfig();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        {/* Backdrop with fade animation */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.backdrop}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
        </Animated.View>

        {/* Modal Sheet with zoom and slide up animation */}
        <Animated.View
          entering={ZoomIn.duration(220)}
          exiting={ZoomOut.duration(180)}
          style={styles.modalCard}
          accessibilityViewIsModal
          testID={testID}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.iconBg, { backgroundColor: `${icon.color}15` }]}>
                <Ionicons name={icon.name as any} size={20} color={icon.color} />
              </View>
              <Typography variant="body" weight="heavy" color={Colors.textPrimary} style={styles.titleText}>
                {title}
              </Typography>
            </View>
            {dismissible && (
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose} accessibilityLabel="Fechar modal">
                <Ionicons name="close" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.content}>
            {description && (
              <Typography variant="body" color={Colors.textSecondary} style={styles.description}>
                {description}
              </Typography>
            )}
            {children}
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <Button
              variant="outline"
              label={cancelLabel}
              onPress={handleClose}
              disabled={loading}
              style={styles.actionBtn}
            />
            {onConfirm && (
              <Button
                variant={destructive || type === 'error' ? 'danger' : 'primary'}
                label={confirmLabel}
                loading={loading}
                onPress={onConfirm}
                style={styles.actionBtn}
              />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(23, 27, 23, 0.9)', // Subtle Liquid Glass background
    borderColor: Colors.border,
    borderWidth: 1.5,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    fontSize: 16,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  content: {
    marginBottom: Spacing.xl,
  },
  description: {
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});
