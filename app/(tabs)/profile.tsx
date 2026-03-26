import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share, Platform, Alert } from 'react-native';
import { Container, Avatar, Card, Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeDbList, safeDbCount } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

// ─── Streak helpers (same logic as daily screen) ──────────────────────────────
function calculateStreak(moods: any[]): number {
  if (!moods || moods.length === 0) return 0;
  const dates = new Set(moods.filter(m => m.date).map(m => m.date));
  if (dates.size === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  let checkDate = new Date(today);
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

// ─── Local storage clear ──────────────────────────────────────────────────────
function clearLocalData() {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem('monsaik_canvas_v1');
      localStorage.removeItem('monsaik_balance_v1');
    }
  } catch {}
}

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['users', 'current_user'],
    queryFn: async () => {
      const results = await safeDbList('users', { where: { id: 'current_user' }, limit: 1 });
      return results[0] || null;
    },
  });

  const { data: moodCount = 0 } = useQuery({
    queryKey: ['moods', 'count'],
    queryFn: () => safeDbCount('moods', { where: { userId: 'current_user' } }),
  });

  const { data: recentMoods = [] } = useQuery({
    queryKey: ['moods', 'streak'],
    queryFn: () => safeDbList('moods', {
      where: { userId: 'current_user' },
      orderBy: { date: 'desc' },
      limit: 30,
    }),
  });

  const streak = useMemo(() => calculateStreak(recentMoods), [recentMoods]);

  const user = {
    displayName: userData?.displayName || 'Pixel Master',
    username: userData?.username || '@pixel_pro',
    pixels: userData?.pixelBalance ?? 0,
    checkIns: moodCount,
    avatarUrl: userData?.avatarUrl || 'https://api.dicebear.com/7.x/pixel-art/svg?seed=PixelMaster',
  };

  const handleInvite = async () => {
    try {
      await Share.share({
        message: 'Komm zu MONSAIK! Erstelle dein eigenes Stimmungs-Mosaik: https://monsaik.app',
      });
    } catch {}
  };

  const handleLogout = () => {
    Alert.alert(
      'Abmelden',
      'Möchtest du deine lokalen Daten zurücksetzen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen',
          style: 'destructive',
          onPress: () => {
            clearLocalData();
            queryClient.clear();
          },
        },
      ]
    );
  };

  if (isLoadingUser) {
    return (
      <Container safeArea edges={['top']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Container>
    );
  }

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + name ── */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <Avatar source={{ uri: user.avatarUrl }} size="xl" />
          <Text style={styles.name}>{user.displayName}</Text>
          <Text style={styles.username}>{user.username}</Text>
        </Animated.View>

        {/* ── Stats row ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)} style={styles.statsGrid}>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="diamond" size={22} color={colors.accent} />
            <Text style={styles.statValue}>{user.pixels}</Text>
            <Text style={styles.statLabel}>{t('profile_pixels')}</Text>
          </Card>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="flame" size={22} color="#FF8C00" />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>{t('profile_streak')}</Text>
          </Card>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            <Text style={styles.statValue}>{user.checkIns}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </Card>
        </Animated.View>

        {/* ── Recent moods mini-strip ── */}
        {recentMoods.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(500)} style={styles.section}>
            <Text style={styles.sectionTitle}>Letzte Stimmungen</Text>
            <View style={styles.moodStrip}>
              {recentMoods.slice(0, 14).map((m: any, i: number) => (
                <View
                  key={m.id || i}
                  style={[styles.moodDot, { backgroundColor: m.color }]}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Actions ── */}
        <Animated.View entering={FadeInDown.delay(240).duration(500)} style={styles.actions}>
          <Pressable style={styles.actionRow} onPress={handleInvite}>
            <View style={styles.actionIcon}>
              <Ionicons name="person-add" size={18} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Freunde einladen</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.actionRow} onPress={handleLogout}>
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            </View>
            <Text style={[styles.actionLabel, { color: '#EF4444' }]}>Daten zurücksetzen</Text>
            <Ionicons name="chevron-forward" size={16} color="#EF4444" />
          </Pressable>
        </Animated.View>

      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  header: { alignItems: 'center', marginBottom: spacing.xl },
  name: { ...typography.h1, color: colors.text, marginTop: spacing.md },
  username: { ...typography.body, color: colors.textMuted },

  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statCard: { flex: 1, alignItems: 'center', padding: spacing.md, gap: 4 },
  statValue: { ...typography.h2, color: colors.text },
  statLabel: { ...typography.tiny, color: colors.textMuted, textAlign: 'center' },

  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.sm },
  moodStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  moodDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    ...shadows.sm,
  },

  actions: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  actionIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: { ...typography.body, color: colors.text, flex: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: spacing.md },
});
