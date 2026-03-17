import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Animated as RNAnimated, useWindowDimensions } from 'react-native';
import { Container } from '@/components/ui';
import { colors, spacing, typography, borderRadius } from '@/constants/design';
import { safeDbList } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { CollaborativeMosaic } from '@/components/CollaborativeMosaic';
import { useI18n } from '@/lib/i18n';
import { useDiscoStore } from '@/lib/store';

const PERSONAL_GRID_COLS = 7;
const DISCO_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
const RAIN_DROP_COUNT = 30;
const RAIN_COLORS = ['#FFD700', '#40E0D0', '#FF4500', '#4169E1', '#8A2BE2', '#FF1493', '#ADFF2F', '#00CED1', '#FF8C00'];

function PixelRainAnimation({ onComplete, screenWidth, screenHeight }: { onComplete: () => void; screenWidth: number; screenHeight: number }) {
  const drops = useRef(
    Array.from({ length: RAIN_DROP_COUNT }, () => ({
      animY: new RNAnimated.Value(0),
      animOpacity: new RNAnimated.Value(1),
      x: Math.random() * Math.max(screenWidth - 40, 40),
      color: RAIN_COLORS[Math.floor(Math.random() * RAIN_COLORS.length)],
      size: 8 + Math.random() * 12,
      delay: Math.random() * 1500,
      duration: 1200 + Math.random() * 1000,
    }))
  ).current;

  useEffect(() => {
    let mounted = true;
    const animations = drops.map((d) =>
      RNAnimated.sequence([
        RNAnimated.delay(d.delay),
        RNAnimated.parallel([
          RNAnimated.timing(d.animY, {
            toValue: 1,
            duration: d.duration,
            useNativeDriver: true,
          }),
          RNAnimated.sequence([
            RNAnimated.delay(d.duration * 0.7),
            RNAnimated.timing(d.animOpacity, {
              toValue: 0,
              duration: d.duration * 0.3,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ])
    );

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
      {drops.map((d, i) => (
        <RNAnimated.View
          key={i}
          style={{
            position: 'absolute',
            left: d.x,
            top: -20,
            width: d.size,
            height: d.size,
            borderRadius: 2,
            backgroundColor: d.color,
            opacity: d.animOpacity,
            transform: [
              {
                translateY: d.animY.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, screenHeight * 0.7],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

export default function MosaicScreen() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const PERSONAL_TILE_SIZE = Math.max(8, (screenWidth - spacing.lg * 2 - spacing.sm * (PERSONAL_GRID_COLS - 1)) / PERSONAL_GRID_COLS);

  const [view, setView] = useState<'personal' | 'global'>('personal');
  const [showPixelRain, setShowPixelRain] = useState(false);
  const { t } = useI18n();
  const { isDiscoEnabled, toggleDisco } = useDiscoStore();
  
  const { data: moods = [], isLoading: isLoadingPersonal } = useQuery({
    queryKey: ['moods'],
    queryFn: () => safeDbList('moods', { orderBy: { date: 'desc' }, limit: 100 }),
    enabled: view === 'personal',
  });

  const [discoTick, setDiscoTick] = useState(0);

  useEffect(() => {
    if (!isDiscoEnabled) return;
    const interval = setInterval(() => {
      setDiscoTick(prev => (prev + 1) % DISCO_COLORS.length);
    }, 400);
    return () => clearInterval(interval);
  }, [isDiscoEnabled]);

  const getDiscoColor = (index: number) => {
    if (!isDiscoEnabled) return undefined;
    return DISCO_COLORS[(discoTick + index) % DISCO_COLORS.length];
  };

  const handleTitleLongPress = () => {
    if (view === 'global' && !showPixelRain) {
      setShowPixelRain(true);
    }
  };

  const renderPersonalItem = ({ item, index }: { item: any, index: number }) => {
    const discoColor = getDiscoColor(index);
    return (
      <View style={{
        width: PERSONAL_TILE_SIZE,
        height: PERSONAL_TILE_SIZE,
        borderRadius: borderRadius.xs,
        backgroundColor: discoColor || item.color,
      }} />
    );
  };

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      {showPixelRain && <PixelRainAnimation onComplete={() => setShowPixelRain(false)} screenWidth={screenWidth} screenHeight={screenHeight} />}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleContainer}>
            <Pressable onLongPress={handleTitleLongPress} delayLongPress={800}>
              <Text style={styles.title}>{view === 'personal' ? t('mosaic_personal') : t('mosaic_global')}</Text>
            </Pressable>
            <View style={styles.segmentControl}>
              <Pressable 
                onPress={() => setView('personal')} 
                style={[styles.segmentButton, view === 'personal' && styles.segmentActive]}
              >
                <Ionicons name="person" size={16} color={view === 'personal' ? '#FFF' : colors.textMuted} />
              </Pressable>
              <Pressable 
                onPress={() => setView('global')} 
                style={[styles.segmentButton, view === 'global' && styles.segmentActive]}
              >
                <Ionicons name="planet" size={16} color={view === 'global' ? '#FFF' : colors.textMuted} />
              </Pressable>
            </View>
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
        <Text style={styles.subtitle}>
          {view === 'personal' 
            ? t('mosaic_personal_subtitle') 
            : t('mosaic_global_subtitle')}
        </Text>
      </View>

      {view === 'global' ? (
        <CollaborativeMosaic />
      ) : (
        isLoadingPersonal ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={moods}
            renderItem={renderPersonalItem}
            keyExtractor={(item) => item.id}
            numColumns={PERSONAL_GRID_COLS}
            columnWrapperStyle={styles.personalGridRow}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="grid-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>{t('mosaic_empty')}</Text>
              </View>
            }
          />
        )
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
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  segmentButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  listContent: {
    padding: spacing.lg,
  },
  personalGridRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  emptyState: {
    marginTop: spacing.xxxl,
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
