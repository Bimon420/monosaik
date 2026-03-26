import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Container } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { safeDbList } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/lib/i18n';
import { useDiscoStore } from '@/lib/store';
import { getUserId } from '@/lib/user';

const DISCO_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
const TOTAL_SLOTS = 128;

function hashColor(seed: string): string {
  const COLORS = ['#FFD700', '#40E0D0', '#FF4500', '#4169E1', '#8A2BE2', '#FF1493', '#ADFF2F', '#FF8C00'];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function SocialScreen() {
  const today = new Date().toISOString().split('T')[0];
  const { t } = useI18n();
  const { isDiscoEnabled, toggleDisco } = useDiscoStore();
  const [discoTick, setDiscoTick] = useState(0);
  const myId = getUserId();

  useEffect(() => {
    if (!isDiscoEnabled) return;
    const interval = setInterval(() => setDiscoTick(p => (p + 1) % DISCO_COLORS.length), 400);
    return () => clearInterval(interval);
  }, [isDiscoEnabled]);

  const getDiscoColor = useCallback((index: number) => {
    if (!isDiscoEnabled) return undefined;
    return DISCO_COLORS[(discoTick + index) % DISCO_COLORS.length];
  }, [isDiscoEnabled, discoTick]);

  // Load today's mood for current user
  const { data: myMood } = useQuery({
    queryKey: ['moods', 'today', myId],
    queryFn: async () => {
      const r = await safeDbList('moods', { where: { userId: myId, date: today }, limit: 1 });
      return r[0] || null;
    },
  });

  // Load all other users + their today moods
  const { data: dbUsers = [], isLoading } = useQuery({
    queryKey: ['social_grid', today],
    queryFn: async () => {
      const [usersRes, moodsRes] = await Promise.all([
        safeDbList('users', { limit: 128 }),
        safeDbList('moods', { where: { date: today }, limit: 500 }),
      ]);
      return usersRes
        .filter((u: any) => u.id !== myId)
        .map((user: any) => ({
          ...user,
          currentMood: moodsRes.find((m: any) => m.userId === user.id),
        }));
    },
  });

  // Build the 128-slot grid: slot 0 is always "me", rest are real users or empty
  const gridSlots = useMemo(() => {
    const me = { id: myId, displayName: 'Du', isMe: true, currentMood: myMood, isEmpty: false };
    const others = dbUsers.slice(0, TOTAL_SLOTS - 1).map((u: any) => ({ ...u, isEmpty: false }));
    const emptyCount = TOTAL_SLOTS - 1 - others.length;
    const empties = Array.from({ length: emptyCount }, (_, i) => ({
      id: `empty_${i}`,
      displayName: '',
      isEmpty: true,
      currentMood: null,
    }));
    return [me, ...others, ...empties];
  }, [dbUsers, myMood, myId]);

  const renderSlot = ({ item, index }: { item: any; index: number }) => {
    if (item.isEmpty) {
      return (
        <View style={styles.slotContainer}>
          <View style={styles.emptyTile}>
            <Ionicons name="add" size={16} color="rgba(255,255,255,0.15)" />
          </View>
          <Text style={styles.emptyLabel}> </Text>
        </View>
      );
    }

    const baseColor = item.currentMood?.color || hashColor(item.id);
    const tileColor = getDiscoColor(index) || baseColor;
    const hasNoMood = !item.currentMood && !item.isMe;

    return (
      <View style={styles.slotContainer}>
        <View style={[
          styles.tile,
          { backgroundColor: tileColor },
          item.isMe && styles.meTile,
          hasNoMood && styles.dimTile,
          isDiscoEnabled && { transform: [{ scale: index % 3 === 0 ? 1.05 : 0.97 }] },
        ]}>
          {item.isMe && (
            <Ionicons name="person" size={14} color="rgba(255,255,255,0.9)" />
          )}
        </View>
        <Text style={[styles.tileLabel, item.isMe && styles.meLabel]} numberOfLines={1}>
          {item.displayName || `…`}
        </Text>
      </View>
    );
  };

  const realUsers = dbUsers.length;
  const filledSlots = realUsers + 1;

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('social_title')}</Text>
            <Text style={styles.subtitle}>{filledSlots} / {TOTAL_SLOTS} Plätze belegt</Text>
          </View>
          <Pressable
            onPress={toggleDisco}
            style={[styles.discoButton, isDiscoEnabled && styles.discoButtonActive]}
          >
            <Ionicons
              name={isDiscoEnabled ? 'musical-notes' : 'disc-outline'}
              size={22}
              color={isDiscoEnabled ? '#FFF' : colors.primary}
            />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={gridSlots}
          renderItem={renderSlot}
          keyExtractor={(item) => item.id}
          numColumns={4}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  discoButton: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  discoButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  title: { ...typography.h1, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  listContent: { paddingHorizontal: spacing.sm, paddingBottom: spacing.xxxl },
  gridRow: { justifyContent: 'flex-start', gap: spacing.xs, marginBottom: spacing.xs },
  slotContainer: { width: '24%', alignItems: 'center' },
  tile: {
    width: '100%', aspectRatio: 1,
    borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    ...shadows.sm,
  },
  meTile: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)' },
  dimTile: { opacity: 0.55 },
  emptyTile: {
    width: '100%', aspectRatio: 1,
    borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tileLabel: { color: colors.textMuted, marginTop: 3, fontSize: 9, fontWeight: '600', textAlign: 'center' },
  meLabel: { color: colors.text, fontWeight: '700' },
  emptyLabel: { height: 14, marginTop: 3 },
  loadingState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
});
