import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator, Animated as RNAnimated, Dimensions } from 'react-native';
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
const CONFETTI_COUNT = 24;
const CONFETTI_COLORS = ['#FFD700', '#FF4500', '#40E0D0', '#FF1493', '#8A2BE2', '#ADFF2F', '#00CED1', '#FF8C00'];
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

function isDark(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

function calculateStreak(moods: any[], includeToday: boolean = true): number {
  if (!moods || moods.length === 0) return 0;
  const dates = new Set(moods.filter(m => m.date).map(m => m.date));
  if (dates.size === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let checkDate = new Date(today);

  if (!includeToday) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (dates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getStreakMilestone(streak: number): string | null {
  if (streak >= 14) return `${streak} Tage 🔥🔥🔥`;
  if (streak >= 7) return `${streak} Tage 🔥🔥`;
  if (streak >= 3) return `${streak} Tage 🔥`;
  return null;
}

function ConfettiAnimation({ onComplete }: { onComplete: () => void }) {
  const particles = useRef(
    Array.from({ length: CONFETTI_COUNT }, () => ({
      animY: new RNAnimated.Value(0),
      animX: new RNAnimated.Value(0),
      animOpacity: new RNAnimated.Value(1),
      startX: Math.random() * SCREEN_WIDTH,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 8,
      drift: (Math.random() - 0.5) * 120,
    }))
  ).current;

  useEffect(() => {
    let mounted = true;
    const animations = particles.map((p, i) => {
      const delay = i * 30;
      return RNAnimated.sequence([
        RNAnimated.delay(delay),
        RNAnimated.parallel([
          RNAnimated.timing(p.animY, {
            toValue: 1,
            duration: 1200 + Math.random() * 600,
            useNativeDriver: true,
          }),
          RNAnimated.timing(p.animX, {
            toValue: 1,
            duration: 1200 + Math.random() * 600,
            useNativeDriver: true,
          }),
          RNAnimated.timing(p.animOpacity, {
            toValue: 0,
            duration: 1400 + Math.random() * 400,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    const composite = RNAnimated.parallel(animations);
    composite.start(() => {
      if (mounted) onComplete();
    });

    return () => {
      mounted = false;
      composite.stop();
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <RNAnimated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.startX,
            top: SCREEN_HEIGHT * 0.3,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.color,
            opacity: p.animOpacity,
            transform: [
              {
                translateY: p.animY.interpolate({
                  inputRange: [0, 0.3, 1],
                  outputRange: [0, -180, SCREEN_HEIGHT * 0.5],
                }),
              },
              {
                translateX: p.animX.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, p.drift],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

export default function DailyMoodScreen() {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [rewardEarned, setRewardEarned] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [discoTick, setDiscoTick] = useState(0);
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { isDiscoEnabled, toggleDisco } = useDiscoStore();
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!isDiscoEnabled) return;
    const interval = setInterval(() => {
      setDiscoTick(prev => (prev + 1) % DISCO_COLORS.length);
    }, 400);
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

  const { data: recentMoods } = useQuery({
    queryKey: ['moods', 'streak'],
    queryFn: async () => {
      return await safeDbList('moods', {
        where: { userId: 'current_user' },
        orderBy: { date: 'desc' },
        limit: 30,
      });
    },
  });

  const streak = useMemo(() => calculateStreak(recentMoods || []), [recentMoods]);
  const streakEndingYesterday = useMemo(() => calculateStreak(recentMoods || [], false), [recentMoods]);
  const streakMilestone = useMemo(() => getStreakMilestone(streak), [streak]);

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
      if (data.isFirstTime && streakEndingYesterday > 0) {
        const newStreak = streakEndingYesterday + 1;
        setCurrentStreak(newStreak);
        setShowConfetti(true);
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
    const displayStreak = currentStreak > 0 ? currentStreak : streak;
    const displayMilestone = getStreakMilestone(displayStreak);
    return (
      <Container safeArea edges={['top']} style={styles.container}>
        {showConfetti && <ConfettiAnimation onComplete={() => setShowConfetti(false)} />}
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
          {displayMilestone && (
            <Animated.View entering={FadeInUp.delay(400).duration(500)} style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>{displayMilestone}</Text>
            </Animated.View>
          )}
          <Animated.View entering={FadeInUp.delay(500)}>
            <Button variant="outline" onPress={() => { setSubmitted(false); setShowConfetti(false); setCurrentStreak(0); }}>
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
          <View style={styles.titleRight}>
            {streakMilestone && (
              <View style={styles.streakPill}>
                <Text style={styles.streakPillText}>{streakMilestone}</Text>
              </View>
            )}
            <Pressable onPress={toggleDisco} style={[styles.discoButton, isDiscoEnabled && styles.discoButtonActive]}>
              <Ionicons name={isDiscoEnabled ? "musical-notes" : "disc-outline"} size={22} color={isDiscoEnabled ? "#FFF" : colors.primary} />
            </Pressable>
          </View>
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
  titleRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
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
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  streakBadge: {
    backgroundColor: '#FF8C00',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  streakBadgeText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
  streakPill: {
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.3)',
  },
  streakPillText: {
    color: '#FF8C00',
    fontWeight: '700',
    fontSize: 11,
  },
});
