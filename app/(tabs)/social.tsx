import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { Container } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { safeDbList } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '@/lib/i18n';
import { useDiscoStore } from '@/lib/store';

const DISCO_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
const FALLBACK_COLORS = ['#FFD700', '#40E0D0', '#FF4500', '#4169E1', '#8A2BE2', '#FF1493', '#ADFF2F', '#FF8C00'];

export default function SocialScreen() {
  const today = new Date().toISOString().split('T')[0];
  const { t } = useI18n();
  const { isDiscoEnabled, toggleDisco } = useDiscoStore();
  const [discoTick, setDiscoTick] = useState(0);

  const getFallbackColor = (seed: string) => {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
  };

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

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['social_grid', today],
    queryFn: async () => {
      const [usersRes, moodsRes] = await Promise.all([
        safeDbList('users', { limit: 128 }),
        safeDbList('moods', { where: { date: today }, limit: 200 }),
      ]);

      return usersRes.map((user: any) => ({
        ...user,
        currentMood: moodsRes.find((m: any) => m.userId === user.id),
      }));
    },
  });

  const renderUser = ({ item, index }: { item: any, index: number }) => {
    const baseColor = item.currentMood?.color || getFallbackColor(item.id);
    const discoColor = getDiscoColor(index);

    return (
      <View style={styles.userContainer}>
        <View style={[
          styles.tile,
          { backgroundColor: discoColor || baseColor },
          isDiscoEnabled && { transform: [{ scale: index % 3 === 0 ? 1.05 : 0.98 }] }
        ]} />
        <Text style={styles.username} numberOfLines={1}>{item.displayName || item.username}</Text>
      </View>
    );
  };

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.title}>{t('social_title')}</Text>
            <Text style={styles.subtitle}>{t('social_subtitle')}</Text>
          </View>
          <Pressable
            onPress={toggleDisco}
            style={[styles.discoButton, isDiscoEnabled && styles.discoButtonActive]}
          >
            <Ionicons
              name={isDiscoEnabled ? "musical-notes" : "disc-outline"}
              size={24}
              color={isDiscoEnabled ? "#FFF" : colors.primary}
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
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          numColumns={4}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.loadingState}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>Noch keine Freunde im Gitter.</Text>
            </View>
          }
        />
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discoButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxxl,
  },
  gridRow: {
    justifyContent: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  userContainer: {
    width: '23.5%',
    alignItems: 'center',
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...shadows.sm,
  },
  username: {
    color: colors.text,
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.9,
  },
  loadingState: {
    marginTop: spacing.xxxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
