import React, { useState } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/design';
import { getUserId, setLocalDisplayName, markOnboarded, ensureUserInDb } from '@/lib/user';

interface Props {
  visible: boolean;
  onComplete: (displayName: string) => void;
}

const MAX_NAME = 24;
const MIN_NAME = 2;

export default function OnboardingModal({ visible, onComplete }: Props) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const trimmed = name.trim();
  const valid = trimmed.length >= MIN_NAME && trimmed.length <= MAX_NAME;

  const handleConfirm = async () => {
    if (!valid) {
      setError(`Mindestens ${MIN_NAME} Zeichen`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const userId = getUserId();
      setLocalDisplayName(trimmed);
      markOnboarded();
      await ensureUserInDb(userId, trimmed);
      onComplete(trimmed);
    } catch {
      setError('Etwas lief schief. Bitte nochmal versuchen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          {/* Logo / visual */}
          <View style={styles.logoRow}>
            {['#FF4500', '#40E0D0', '#FFD700', '#8A2BE2'].map((c, i) => (
              <View key={i} style={[styles.logoDot, { backgroundColor: c }]} />
            ))}
          </View>

          <Text style={styles.title}>Willkommen bei MONSAIK</Text>
          <Text style={styles.subtitle}>
            Wähle deinen Namen für das Gemeinschafts-Mosaik
          </Text>

          <TextInput
            style={[styles.input, error ? styles.inputError : null]}
            placeholder="Dein Name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={t => { setName(t); setError(''); }}
            maxLength={MAX_NAME}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.hint}>{trimmed.length}/{MAX_NAME}</Text>

          <Pressable
            style={[styles.button, (!valid || loading) && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={!valid || loading}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.buttonText}>Los geht's</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xxl,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  logoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.lg,
  },
  logoDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  input: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: spacing.xs,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 11,
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
