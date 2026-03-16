import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator } from 'react-native';
import { Container, Button } from '@/components/ui';
import { colors, spacing, typography, shadows } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { safeDbCreate, safeDbList, safeDbUpdate, safeDbUpdateUserPixels, safeDbGet } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MOOD_COLORS, THEME_MOODS } from '@/lib/themes';
import { useI18n } from '@/lib/i18n';
import { useDiscoStore } from '@/lib/store';

const DISCO_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
const ITEM_SIZE = 80;
const CIRCLE_SIZE = 60;

function isDark(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

export default function DailyMoodScreen() {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [rewardEarned, setRewardEarned] = useState(false);
  const [discoTick, setDiscoTick] = useState(0);
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { isDiscoEnabled, toggleDisco } = useDiscoStore();
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!isDiscoEnabled) return;
    const interval = setInterval(() => {
      setDiscoTick(prev => (prev + 1) % DISCO_COLORS.length);
    }, 300);
    return () => clearInterval(interval);
  }, [isDiscoEnabled]);

  const getDiscoColor = useCallback((index: number) => {
    if (!isDiscoEnabled) return undefined;
    return DISCO_COLORS[(discoTick + index) % DISCO_COLORS.length];
  }, [isDiscoEnabled, discoTick]);

  const { data: todayMood, isLoading: isLoadingToday } = useQuery({
    queryKey: ['moods', 'today'],
    queryFn: async () => {
      const results = await safeDbList('moods', {
        where: { userId: 'current_user', date: today },
        limit: 1
      });
      return results[0] || null;
    }
  });

  const { data: userData } = useQuery({
    queryKey: ['users', 'current_user'],
    queryFn: () => safeDbGet('users', 'current_user'),
  });

  const activeTheme = userData?.themeIcon || 'classic';
  const themeIcons = THEME_MOODS[activeTheme] || THEME_MOODS.classic;

  useEffect(() => {
    if (todayMood && !selectedMood && !submitted) {
      setSelectedMood(todayMood.color);
    }
  }, [todayMood]);

  const mutation = useMutation({
    mutationFn: async (mood: { color: string; name: string }) => {
      let result;
      const isFirstTime = !todayMood;
      if (todayMood) {
        result = await safeDbUpdate('moods', todayMood.id, { color: mood.color, moodName: mood.name });
      } else {
        result = await safeDbCreate('moods', { color: mood.color, moodName: mood.name, date: today, userId: 'current_user' });
        await safeDbUpdateUserPixels('current_user', 10);
      }
      if (!result) throw new Error('Failed to save mood');
      return { result, isFirstTime };
    },
    onSuccess: (data) => {
      setRewardEarned(data.isFirstTime);
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['moods'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'current_user'] });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const handleMoodSelect = (mood: typeof MOOD_COLORS[0]) => {
    setSelectedMood(mood.color);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleSubmit = () => {
    if (selectedMood) {
      const mood = MOOD_COLORS.find(m => m.color === selectedMood);
      if (mood) mutation.mutate(mood);
    }
  };

  if (isLoadingToday) {
    return (
      <Container safeArea edges={['top']} style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Container>
    );
  }

  if (submitted) {
    const mood = MOOD_COLORS.find(m => m.color === selectedMood);
    const moodIndex = MOOD_COLORS.findIndex(m => m.color === selectedMood);
    const iconName = themeIcons[moodIndex]?.icon || 'checkmark';
    const circleColor = isDiscoEnabled ? getDiscoColor(0) : (selectedMood || colors.primary);
    const iconColor = isDiscoEnabled ? '#FFF' : (selectedMood && isDark(selectedMood) ? '#FFF' : '#000');
    return (
      <Container safeArea edges={['top']} style={styles.container}>
        <View style={styles.discoRow}>
          <Pressable onPress={toggleDisco} style={[styles.discoButton, isDiscoEnabled && styles.discoButtonActive]}>
            <Ionicons name={isDiscoEnabled ? "musical-notes" : "disc-outline"} size={22} color={isDiscoEnabled ? "#FFF" : colors.primary} />
          </Pressable>
        </View>
        <View style={styles.centerContent}>
          <Animated.View entering={FadeInDown.duration(600)} style={[styles.successCircle, { backgroundColor: circleColor }]}>
            <Ionicons name={iconName as any} size={44} color={iconColor} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(200).duration(500)} style={styles.successTitle}>
            {rewardEarned ? t('daily_success_title') : t('daily_update_title')}
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(300).duration(500)} style={styles.successSubtitle}>
            {mood?.name} {rewardEarned ? `— ${t('daily_reward')}` : `— ${t('daily_no_reward')}`}
          </Animated.Text>
          <Animated.View entering={FadeInUp.delay(500)}>
            <Button variant="outline" onPress={() => { setSubmitted(false); }}>
              {t('daily_back')}
            </Button>
          </Animated.View>
        </View>
      </Container>
    );
  }

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.titleBlock}>
            <Text style={styles.title}>{t('daily_title')}</Text>
            <Text style={styles.subtitle}>{t('daily_subtitle')}</Text>
          </Animated.View>
          <Pressable onPress={toggleDisco} style={[styles.discoButton, isDiscoEnabled && styles.discoButtonActive]}>
            <Ionicons name={isDiscoEnabled ? "musical-notes" : "disc-outline"} size={22} color={isDiscoEnabled ? "#FFF" : colors.primary} />
          </Pressable>
        </View>

        <View style={styles.gridContainer}>
          <View style={styles.grid}>
            {MOOD_COLORS.map((mood, index) => {
              const discoColor = getDiscoColor(index);
              const effectiveColor = discoColor || mood.color;
              const iconColor = (selectedMood === mood.color || isDiscoEnabled)
                ? (isDark(effectiveColor) ? '#FFF' : '#000')
                : 'rgba(255,255,255,0.4)';
              return (
                <View key={mood.color} style={styles.moodItem}>
                  <Pressable onPress={() => handleMoodSelect(mood)}>
                    <View style={[
                      styles.colorCircle,
                      { backgroundColor: effectiveColor },
                      selectedMood === mood.color && styles.selectedCircle,
                      isDiscoEnabled && { transform: [{ scale: index % 2 === 0 ? 1.08 : 0.95 }] }
                    ]}>
                      <Ionicons
                        name={themeIcons[index]?.icon as any || 'help'}
                        size={22}
                        color={iconColor}
                      />
                    </View>
                  </Pressable>
                  <Text style={styles.moodName}>{mood.name}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <Animated.View entering={FadeInUp.delay(200)} style={styles.footer}>
          <Button
            variant={todayMood ? "outline" : "primary"}
            size="lg"
            onPress={handleSubmit}
            loading={mutation.isPending}
            style={styles.submitButton}
            disabled={todayMood?.color === selectedMood}
          >
            {todayMood
              ? (todayMood.color === selectedMood ? t('daily_logged') : t('daily_update'))
              : t('daily_submit')
            }
          </Button>
          {mutation.isError && (
            <Text style={styles.errorText}>Fehler beim Speichern — Versuche es später erneut.</Text>
          )}
        </Animated.View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  titleBlock: {
    flex: 1,
  },
  discoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  discoButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  discoButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  gridContainer: {
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    maxWidth: 400,
  },
  moodItem: {
    width: ITEM_SIZE,
    alignItems: 'center',
    marginBottom: 4,
  },
  colorCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.md,
  },
  selectedCircle: {
    borderWidth: 3,
    borderColor: '#FFF',
    transform: [{ scale: 1.08 }],
  },
  moodName: {
    color: colors.text,
    marginTop: 4,
    fontWeight: '600',
    fontSize: 9,
    lineHeight: 12,
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing.md,
  },
  submitButton: {
    width: '100%',
    height: 54,
  },
  errorText: {
    fontSize: 12,
    color: '#FF4500',
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    ...typography.h1,
    color: colors.text,
  },
  successSubtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
});
