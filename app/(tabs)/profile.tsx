import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share, Alert, Platform } from 'react-native';
import { Container, Avatar, Card } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeDbList, safeDbCount } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { getUserId, setLocalDisplayName, ensureUserInDb, clearAllLocalData } from '@/lib/user';
import { makeInviteCode } from '@/lib/friends';
import { getOwnedItems } from '@/lib/shop';

function calculateStreak(moods: any[]): number {
  if (!moods || moods.length === 0) return 0;
  const dates = new Set(moods.filter(m => m.date).map(m => m.date));
  if (dates.size === 0) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let streak = 0; let checkDate = new Date(today);
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (dates.has(dateStr)) { streak++; checkDate.setDate(checkDate.getDate() - 1); } else break;
  }
  return streak;
}

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const userId = getUserId();
  const myCode = makeInviteCode(userId);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ['users', userId],
    queryFn: async () => {
      const results = await safeDbList('users', { where: { id: userId }, limit: 1 });
      return results[0] || null;
    },
  });

  const { data: moodCount = 0 } = useQuery({
    queryKey: ['moods', 'count', userId],
    queryFn: () => safeDbCount('moods', { where: { userId } }),
  });

  const { data: recentMoods = [] } = useQuery({
    queryKey: ['moods', 'streak', userId],
    queryFn: () => safeDbList('moods', {
      where: { userId },
      orderBy: { date: 'desc' },
      limit: 30,
    }),
  });

  const streak = useMemo(() => calculateStreak(recentMoods), [recentMoods]);
  const ownedItems = useMemo(() => getOwnedItems(), []);

  const user = {
    displayName: userData?.displayName || 'Pixel Master',
    username: userData?.username || `@user_${userId.slice(0, 6)}`,
    pixels: userData?.pixelBalance ?? 0,
    avatarUrl: userData?.avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${userId}`,
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) return;
    setLocalDisplayName(trimmed);
    await ensureUserInDb(userId, trimmed);
    queryClient.invalidateQueries({ queryKey: ['users', userId] });
    setEditingName(false);
  };

  const handleShareCode = async () => {
    try {
      await Share.share({
        message: `Mein MONSAIK-Code: ${myCode}\nFüg mich als Freund hinzu in der App!`,
      });
    } catch {}
  };

  const handleLogout = () => {
    Alert.alert(
      'Zurücksetzen',
      'Alle lokalen Daten löschen und neu starten?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Zurücksetzen', style: 'destructive',
          onPress: () => { clearAllLocalData(); queryClient.clear(); },
        },
      ]
    );
  };

  if (isLoadingUser) {
    return (
      <Container safeArea edges={['top']} style={styles.container}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </Container>
    );
  }

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Avatar + name ── */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.header}>
          <Avatar source={{ uri: user.avatarUrl }} size="xl" />
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                maxLength={24}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
                placeholder="Dein Name"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable style={styles.nameBtn} onPress={handleSaveName}>
                <Ionicons name="checkmark" size={18} color="#FFF" />
              </Pressable>
              <Pressable style={styles.nameBtnCancel} onPress={() => setEditingName(false)}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.nameRow} onPress={() => { setNameInput(user.displayName); setEditingName(true); }}>
              <Text style={styles.name}>{user.displayName}</Text>
              <Ionicons name="pencil" size={13} color={colors.textMuted} style={{ marginLeft: 6, marginTop: 4 }} />
            </Pressable>
          )}
          <Text style={styles.username}>{user.username}</Text>
        </Animated.View>

        {/* ── Stats ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)} style={styles.statsGrid}>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="diamond" size={20} color={colors.accent} />
            <Text style={styles.statValue}>{user.pixels}</Text>
            <Text style={styles.statLabel}>Pixels</Text>
          </Card>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="flame" size={20} color="#FF8C00" />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </Card>
          <Card variant="elevated" style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{moodCount}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </Card>
        </Animated.View>

        {/* ── Recent moods strip ── */}
        {recentMoods.length > 0 && (
          <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.section}>
            <Text style={styles.sectionTitle}>Letzte Stimmungen</Text>
            <View style={styles.moodStrip}>
              {recentMoods.slice(0, 14).map((m: any, i: number) => (
                <View key={m.id || i} style={[styles.moodDot, { backgroundColor: m.color }]} />
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Owned items badge ── */}
        {ownedItems.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(500)} style={styles.section}>
            <Text style={styles.sectionTitle}>Meine Items ({ownedItems.length})</Text>
            <View style={styles.badgeRow}>
              <View style={styles.badgePill}>
                <Ionicons name="bag-check" size={14} color={colors.accent} />
                <Text style={styles.badgeText}>{ownedItems.length} freigeschaltet</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Invite code ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Mein Einladungscode</Text>
          <Pressable style={styles.codeCard} onPress={handleShareCode}>
            <Text style={styles.codeText}>{myCode}</Text>
            <View style={styles.shareBtn}>
              <Ionicons name="share-outline" size={16} color={colors.primary} />
              <Text style={styles.shareBtnText}>Teilen</Text>
            </View>
          </Pressable>
          <Text style={styles.codeHint}>Freunde können diesen Code nutzen, um dich zu finden.</Text>
        </Animated.View>

        {/* ── Actions ── */}
        <Animated.View entering={FadeInDown.delay(240).duration(500)} style={styles.actions}>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  header: { alignItems: 'center', marginBottom: spacing.xl },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  name: { ...typography.h1, color: colors.text },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md, width: '100%' },
  nameInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    paddingVertical: 8, paddingHorizontal: spacing.md,
    color: colors.text, fontSize: 18, fontWeight: '700',
    borderWidth: 1, borderColor: colors.primary,
  },
  nameBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  nameBtnCancel: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  username: { ...typography.body, color: colors.textMuted, marginTop: 2 },

  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statCard: { flex: 1, alignItems: 'center', padding: spacing.md, gap: 4 },
  statValue: { ...typography.h2, color: colors.text },
  statLabel: { ...typography.tiny, color: colors.textMuted, textAlign: 'center' },

  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.captionBold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm },
  moodStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  moodDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },

  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${colors.accent}18`, borderRadius: borderRadius.full,
    paddingVertical: 6, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: `${colors.accent}30`,
  },
  badgeText: { ...typography.small, color: colors.accent, fontWeight: '600' },

  codeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.md, gap: spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  codeText: {
    flex: 1, color: colors.text, fontSize: 18,
    fontWeight: '800', letterSpacing: 2.5, fontFamily: 'monospace',
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: `${colors.primary}20`, borderRadius: borderRadius.md,
    paddingVertical: 6, paddingHorizontal: spacing.sm,
  },
  shareBtnText: { ...typography.small, color: colors.primary, fontWeight: '700' },
  codeHint: { ...typography.tiny, color: colors.textMuted, marginTop: spacing.xs },

  actions: {
    backgroundColor: colors.card, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  actionIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { ...typography.body, color: colors.text, flex: 1 },
});
