import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions } from 'react-native';
import { Container, Button, Card } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { 
  FadeInDown, 
  FadeInUp, 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence, 
  withTiming 
} from 'react-native-reanimated';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { safeDbUpdateUserPixels } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { MOOD_COLORS } from '@/lib/themes';

const GRID_SIZE = 3;
const WIN_REWARD = 25;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_SIZE = Math.floor((SCREEN_WIDTH - spacing.xl * 2 - spacing.md * 2) / GRID_SIZE);

export default function GamesScreen() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  
  const [targetPattern, setTargetPattern] = useState<string[]>([]);
  const [userPattern, setUserPattern] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  
  const winScale = useSharedValue(1);

  // Generate a random pattern
  const generatePattern = useCallback(() => {
    const newPattern = [];
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const randomColor = MOOD_COLORS[Math.floor(Math.random() * MOOD_COLORS.length)].color;
      newPattern.push(randomColor);
    }
    setTargetPattern(newPattern);
    setUserPattern(new Array(GRID_SIZE * GRID_SIZE).fill('#222'));
    setIsPlaying(true);
    setHasWon(false);
  }, []);

  const rewardMutation = useMutation({
    mutationFn: () => safeDbUpdateUserPixels('current_user', WIN_REWARD),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'current_user'] });
    }
  });

  const handleTilePress = (index: number) => {
    if (!isPlaying || hasWon) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const newUserPattern = [...userPattern];
    const currentColor = newUserPattern[index];
    const colorIndex = MOOD_COLORS.findIndex(m => m.color === currentColor);
    const nextColorIndex = (colorIndex + 1) % MOOD_COLORS.length;
    newUserPattern[index] = MOOD_COLORS[nextColorIndex].color;
    
    setUserPattern(newUserPattern);

    // Check win condition
    if (newUserPattern.every((color, i) => color === targetPattern[i])) {
      handleWin();
    }
  };

  const handleWin = () => {
    setHasWon(true);
    setIsPlaying(false);
    rewardMutation.mutate();
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    winScale.value = withSequence(
      withSpring(1.2),
      withSpring(1)
    );
  };

  const animatedWinStyle = useAnimatedStyle(() => ({
    transform: [{ scale: winScale.value }]
  }));

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('games_title')}</Text>
        <Text style={styles.subtitle}>{t('games_subtitle')}</Text>
      </View>

      <View style={styles.content}>
        {!isPlaying && !hasWon ? (
          <Animated.View entering={FadeInDown} style={styles.startContainer}>
            <Ionicons name="game-controller" size={80} color={colors.primary} />
            <Text style={styles.gameName}>{t('game_pixel_match_title')}</Text>
            <Text style={styles.gameDesc}>{t('game_pixel_match_desc')}</Text>
            <Button 
              variant="primary" 
              size="lg" 
              onPress={generatePattern}
              style={styles.startButton}
            >
              {t('game_pixel_match_start')}
            </Button>
          </Animated.View>
        ) : (
          <View style={styles.gameBoard}>
            {/* Target Pattern */}
            <View style={styles.targetSection}>
              <Text style={styles.sectionLabel}>Ziel:</Text>
              <View style={styles.grid}>
                {targetPattern.map((color, i) => (
                  <View 
                    key={`target-${i}`} 
                    style={[styles.tile, styles.targetTile, { backgroundColor: color }]} 
                  />
                ))}
              </View>
            </View>

            <Ionicons name="arrow-down" size={32} color={colors.textMuted} style={styles.arrow} />

            {/* User Pattern */}
            <Animated.View style={[styles.userSection, hasWon && animatedWinStyle]}>
              <View style={styles.grid}>
                {userPattern.map((color, i) => (
                  <Pressable 
                    key={`user-${i}`} 
                    onPress={() => handleTilePress(i)}
                    style={[
                      styles.tile, 
                      { backgroundColor: color },
                      isPlaying && styles.interactiveTile
                    ]}
                  />
                ))}
              </View>
            </Animated.View>

            {hasWon && (
              <Animated.View entering={FadeInUp} style={styles.winBanner}>
                <Ionicons name="trophy" size={24} color="#FFD700" />
                <Text style={styles.winText}>{t('game_pixel_match_win')}</Text>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onPress={generatePattern}
                  style={styles.resetButton}
                >
                  {t('game_pixel_match_reset')}
                </Button>
              </Animated.View>
            )}
          </View>
        )}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    padding: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  startContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  gameName: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  gameDesc: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  startButton: {
    width: 200,
  },
  gameBoard: {
    alignItems: 'center',
    width: '100%',
  },
  targetSection: {
    alignItems: 'center',
    marginBottom: spacing.md,
    opacity: 0.8,
  },
  userSection: {
    alignItems: 'center',
  },
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: TILE_SIZE * GRID_SIZE + spacing.sm * (GRID_SIZE - 1),
    gap: spacing.sm,
    justifyContent: 'center',
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: borderRadius.sm,
    ...shadows.sm,
  },
  targetTile: {
    width: TILE_SIZE * 0.6,
    height: TILE_SIZE * 0.6,
  },
  interactiveTile: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  arrow: {
    marginVertical: spacing.md,
  },
  winBanner: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    ...shadows.lg,
  },
  winText: {
    ...typography.h3,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  resetButton: {
    marginTop: spacing.sm,
  },
});