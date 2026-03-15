import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { Container, Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { safeDbUpdateUserPixels } from '@/lib/api';
import { MOOD_COLORS } from '@/lib/themes';

type GameId = 'pixel_match' | 'color_flash' | 'pixel_hunt';

const PIXEL_MATCH_REWARD = 25;
const COLOR_FLASH_REWARD = 15;
const PIXEL_HUNT_REWARD = 20;
const GRID_SIZE = 3;
const FLASH_COLORS = MOOD_COLORS.slice(0, 8);
const FLASH_ROUNDS = 5;
const FLASH_DURATION = 1600;
const HUNT_COLORS = MOOD_COLORS.slice(0, 6);
const HUNT_TARGET_SCORE = 8;
const HUNT_INTERVAL = 1100;
const HUNT_LIT_DURATION = 750;

function useRewardMutation(reward: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => safeDbUpdateUserPixels('current_user', reward),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', 'current_user'] }),
  });
}

// ===== PIXEL MATCH GAME =====
function PixelMatchGame({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const tileSize = Math.floor((Math.min(width, 480) - spacing.xl * 2 - spacing.sm * (GRID_SIZE - 1)) / GRID_SIZE);

  const [targetPattern, setTargetPattern] = useState<string[]>([]);
  const [userPattern, setUserPattern] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const rewardMutation = useRewardMutation(PIXEL_MATCH_REWARD);
  const winScale = useSharedValue(1);
  const animatedWinStyle = useAnimatedStyle(() => ({ transform: [{ scale: winScale.value }] }));

  const generatePattern = useCallback(() => {
    const newPattern = Array.from({ length: GRID_SIZE * GRID_SIZE }, () =>
      MOOD_COLORS[Math.floor(Math.random() * MOOD_COLORS.length)].color
    );
    setTargetPattern(newPattern);
    setUserPattern(new Array(GRID_SIZE * GRID_SIZE).fill(MOOD_COLORS[0].color));
    setIsPlaying(true);
    setHasWon(false);
  }, []);

  const handleTilePress = (index: number) => {
    if (!isPlaying || hasWon) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newPattern = [...userPattern];
    const colorIndex = MOOD_COLORS.findIndex(m => m.color === newPattern[index]);
    newPattern[index] = MOOD_COLORS[(colorIndex + 1) % MOOD_COLORS.length].color;
    setUserPattern(newPattern);
    if (newPattern.every((c, i) => c === targetPattern[i])) {
      setHasWon(true);
      setIsPlaying(false);
      rewardMutation.mutate();
      winScale.value = withSequence(withSpring(1.2), withSpring(1));
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const smallTile = Math.floor(tileSize * 0.62);

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <View style={s.gameHeader}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.gameTitle}>Muster-Match</Text>
        <View style={s.rewardBadge}><Text style={s.rewardText}>+{PIXEL_MATCH_REWARD}px</Text></View>
      </View>
      <View style={s.gameContent}>
        {!isPlaying && !hasWon ? (
          <Animated.View entering={FadeInDown} style={s.startContainer}>
            <View style={[s.gameIconBg, { backgroundColor: '#7C3AED20' }]}>
              <Ionicons name="grid" size={48} color="#7C3AED" />
            </View>
            <Text style={s.gameDescTitle}>Muster-Match</Text>
            <Text style={s.gameDesc}>Tippe auf die Felder, um ihre Farbe zu wechseln und das Zielmuster zu kopieren.</Text>
            <Button variant="primary" size="lg" onPress={generatePattern} style={s.startButton}>Spiel starten</Button>
          </Animated.View>
        ) : (
          <View style={s.gameBoard}>
            <View style={s.patternSection}>
              <Text style={s.sectionLabel}>Ziel</Text>
              <View style={[s.grid, { gap: spacing.xs }]}>
                {targetPattern.map((color, i) => (
                  <View key={i} style={[s.tile, { width: smallTile, height: smallTile, backgroundColor: color }]} />
                ))}
              </View>
            </View>
            <Ionicons name="arrow-down" size={20} color={colors.textMuted} style={{ marginVertical: spacing.sm }} />
            <Animated.View style={hasWon ? animatedWinStyle : undefined}>
              <Text style={s.sectionLabel}>Dein Muster</Text>
              <View style={[s.grid, { gap: spacing.sm }]}>
                {userPattern.map((color, i) => (
                  <Pressable
                    key={i}
                    onPress={() => handleTilePress(i)}
                    style={[s.tile, { width: tileSize, height: tileSize, backgroundColor: color, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }]}
                  />
                ))}
              </View>
            </Animated.View>
            {hasWon && (
              <Animated.View entering={FadeInUp} style={s.winBanner}>
                <Ionicons name="trophy" size={24} color="#FFD700" />
                <Text style={s.winText}>+{PIXEL_MATCH_REWARD} Pixels!</Text>
                <Button variant="outline" size="sm" onPress={generatePattern}>Nochmal</Button>
              </Animated.View>
            )}
          </View>
        )}
      </View>
    </Container>
  );
}

// ===== COLOR FLASH GAME =====
function ColorFlashGame({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'show' | 'pick' | 'won' | 'lost'>('idle');
  const [round, setRound] = useState(0);
  const [targetColor, setTargetColor] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<boolean | null>(null);
  const rewardMutation = useRewardMutation(COLOR_FLASH_REWARD);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const startRound = useCallback((currentRound: number) => {
    const target = FLASH_COLORS[Math.floor(Math.random() * FLASH_COLORS.length)];
    setTargetColor(target.color);
    setPhase('show');
    setLastResult(null);
    timerRef.current = setTimeout(() => {
      const others = FLASH_COLORS
        .filter(c => c.color !== target.color)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(c => c.color);
      setOptions([...others, target.color].sort(() => Math.random() - 0.5));
      setPhase('pick');
    }, FLASH_DURATION);
  }, []);

  const handlePick = (color: string) => {
    const correct = color === targetColor;
    setLastResult(correct);
    if (Platform.OS !== 'web') {
      correct
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    if (correct) {
      const nextRound = round + 1;
      setRound(nextRound);
      if (nextRound >= FLASH_ROUNDS) {
        setPhase('won');
        rewardMutation.mutate();
      } else {
        setTimeout(() => startRound(nextRound), 700);
      }
    } else {
      setPhase('lost');
    }
  };

  const reset = () => { setRound(0); setLastResult(null); setPhase('idle'); };

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <View style={s.gameHeader}>
        <Pressable onPress={onBack} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.gameTitle}>Farbblitz</Text>
        <View style={s.rewardBadge}><Text style={s.rewardText}>+{COLOR_FLASH_REWARD}px</Text></View>
      </View>
      <View style={s.gameContent}>
        {phase === 'idle' && (
          <Animated.View entering={FadeInDown} style={s.startContainer}>
            <View style={[s.gameIconBg, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="flash" size={48} color="#10B981" />
            </View>
            <Text style={s.gameDescTitle}>Farbblitz</Text>
            <Text style={s.gameDesc}>
              Eine Farbe blitzt kurz auf. Merke sie dir und wähle sie aus 4 Optionen. {FLASH_ROUNDS} richtige = Sieg!
            </Text>
            <Button variant="primary" size="lg" onPress={() => { setRound(0); startRound(0); }} style={s.startButton}>Starten</Button>
          </Animated.View>
        )}
        {phase === 'show' && (
          <Animated.View entering={FadeInDown} style={s.flashContainer}>
            <Text style={s.flashLabel}>Merke dir diese Farbe!</Text>
            <View style={[s.flashColor, { backgroundColor: targetColor }]} />
            <Text style={s.roundIndicator}>{round + 1} / {FLASH_ROUNDS}</Text>
          </Animated.View>
        )}
        {phase === 'pick' && (
          <Animated.View entering={FadeInDown} style={s.pickContainer}>
            <Text style={s.flashLabel}>Welche Farbe war es?</Text>
            <View style={s.optionsGrid}>
              {options.map((color, i) => (
                <Pressable
                  key={i}
                  onPress={() => handlePick(color)}
                  style={[s.optionColor, { backgroundColor: color }]}
                />
              ))}
            </View>
            {lastResult !== null && (
              <Text style={[s.feedbackText, { color: lastResult ? '#10B981' : '#EF4444' }]}>
                {lastResult ? '✓ Richtig!' : '✗ Falsch!'}
              </Text>
            )}
          </Animated.View>
        )}
        {(phase === 'won' || phase === 'lost') && (
          <Animated.View entering={FadeInUp} style={s.endContainer}>
            <Ionicons
              name={phase === 'won' ? 'trophy' : 'close-circle'}
              size={72}
              color={phase === 'won' ? '#FFD700' : '#EF4444'}
            />
            <Text style={s.winBigText}>{phase === 'won' ? 'Gewonnen!' : 'Falsch!'}</Text>
            <Text style={s.winSubText}>
              {phase === 'won' ? `+${COLOR_FLASH_REWARD} Pixels verdient` : 'Versuche es nochmal.'}
            </Text>
            <Button variant="primary" onPress={reset} style={s.startButton}>Nochmal</Button>
          </Animated.View>
        )}
      </View>
    </Container>
  );
}

// ===== PIXEL HUNT GAME =====
function PixelHuntGame({ onBack }: { onBack: () => void }) {
  const [targetColor, setTargetColor] = useState(HUNT_COLORS[0].color);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [activeTileColor, setActiveTileColor] = useState('');
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won'>('idle');
  const litTimerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const scoreRef = useRef(0);
  const targetColorRef = useRef(HUNT_COLORS[0].color);
  const rewardMutation = useRewardMutation(PIXEL_HUNT_REWARD);

  const stopGame = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (litTimerRef.current) clearTimeout(litTimerRef.current);
  }, []);

  useEffect(() => () => stopGame(), []);

  const startGame = useCallback(() => {
    const newTarget = HUNT_COLORS[Math.floor(Math.random() * HUNT_COLORS.length)];
    setTargetColor(newTarget.color);
    targetColorRef.current = newTarget.color;
    setScore(0);
    scoreRef.current = 0;
    setActiveTile(null);
    setGameState('playing');

    intervalRef.current = setInterval(() => {
      const tileIndex = Math.floor(Math.random() * 9);
      const useTarget = Math.random() < 0.55;
      const wrongColors = HUNT_COLORS.filter(c => c.color !== targetColorRef.current);
      const color = useTarget
        ? targetColorRef.current
        : wrongColors[Math.floor(Math.random() * wrongColors.length)].color;

      setActiveTile(tileIndex);
      setActiveTileColor(color);

      if (litTimerRef.current) clearTimeout(litTimerRef.current);
      litTimerRef.current = setTimeout(() => setActiveTile(null), HUNT_LIT_DURATION);
    }, HUNT_INTERVAL);
  }, []);

  const handleTilePress = useCallback((index: number) => {
    if (gameState !== 'playing' || activeTile !== index) return;

    if (activeTileColor === targetColorRef.current) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newScore = scoreRef.current + 1;
      scoreRef.current = newScore;
      setScore(newScore);
      setActiveTile(null);

      if (newScore >= HUNT_TARGET_SCORE) {
        stopGame();
        setGameState('won');
        rewardMutation.mutate();
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [gameState, activeTile, activeTileColor, stopGame]);

  const reset = () => { stopGame(); setScore(0); setActiveTile(null); setGameState('idle'); };

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <View style={s.gameHeader}>
        <Pressable onPress={() => { stopGame(); onBack(); }} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.gameTitle}>Pixel-Jagd</Text>
        <View style={s.rewardBadge}><Text style={s.rewardText}>+{PIXEL_HUNT_REWARD}px</Text></View>
      </View>
      <View style={s.gameContent}>
        {gameState === 'idle' && (
          <Animated.View entering={FadeInDown} style={s.startContainer}>
            <View style={[s.gameIconBg, { backgroundColor: '#F59E0B20' }]}>
              <Ionicons name="locate" size={48} color="#F59E0B" />
            </View>
            <Text style={s.gameDescTitle}>Pixel-Jagd</Text>
            <Text style={s.gameDesc}>
              Ein Feld leuchtet auf! Tippe es nur wenn es die Zielfarbe zeigt. {HUNT_TARGET_SCORE} richtige Treffer = Sieg!
            </Text>
            <Button variant="primary" size="lg" onPress={startGame} style={s.startButton}>Jagen!</Button>
          </Animated.View>
        )}
        {gameState === 'playing' && (
          <View style={s.huntContainer}>
            <View style={s.targetRow}>
              <Text style={s.sectionLabel}>Zielfarbe:</Text>
              <View style={[s.huntTarget, { backgroundColor: targetColor }]} />
            </View>
            <Text style={s.scoreText}>{score} / {HUNT_TARGET_SCORE}</Text>
            <View style={s.huntGrid}>
              {Array.from({ length: 9 }).map((_, i) => {
                const isActive = activeTile === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => handleTilePress(i)}
                    style={[
                      s.huntTile,
                      isActive
                        ? { backgroundColor: activeTileColor, borderColor: 'rgba(255,255,255,0.3)' }
                        : { backgroundColor: colors.surface }
                    ]}
                  />
                );
              })}
            </View>
            <Text style={s.huntHint}>Tippe nur auf die Zielfarbe!</Text>
          </View>
        )}
        {gameState === 'won' && (
          <Animated.View entering={FadeInUp} style={s.endContainer}>
            <Ionicons name="trophy" size={72} color="#FFD700" />
            <Text style={s.winBigText}>Gewonnen!</Text>
            <Text style={s.winSubText}>+{PIXEL_HUNT_REWARD} Pixels verdient</Text>
            <Button variant="primary" onPress={reset} style={s.startButton}>Nochmal</Button>
          </Animated.View>
        )}
      </View>
    </Container>
  );
}

// ===== GAME HUB =====
const GAME_CARDS = [
  {
    id: 'pixel_match' as GameId,
    icon: 'grid' as const,
    color: '#7C3AED',
    reward: PIXEL_MATCH_REWARD,
    title: 'Muster-Match',
    desc: 'Kopiere das Farbmuster durch Antippen der Felder.',
  },
  {
    id: 'color_flash' as GameId,
    icon: 'flash' as const,
    color: '#10B981',
    reward: COLOR_FLASH_REWARD,
    title: 'Farbblitz',
    desc: 'Merke dir die aufblitzende Farbe und wähle sie aus.',
  },
  {
    id: 'pixel_hunt' as GameId,
    icon: 'locate' as const,
    color: '#F59E0B',
    reward: PIXEL_HUNT_REWARD,
    title: 'Pixel-Jagd',
    desc: 'Tippe schnell auf das Feld mit der richtigen Farbe!',
  },
];

export default function GamesScreen() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  if (activeGame === 'pixel_match') return <PixelMatchGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'color_flash') return <ColorFlashGame onBack={() => setActiveGame(null)} />;
  if (activeGame === 'pixel_hunt') return <PixelHuntGame onBack={() => setActiveGame(null)} />;

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <View style={s.hubHeader}>
        <Text style={s.hubTitle}>Spiele</Text>
        <Text style={s.hubSubtitle}>Verdiene Pixels mit Mini-Spielen.</Text>
      </View>
      <ScrollView contentContainerStyle={s.hubList} showsVerticalScrollIndicator={false}>
        {GAME_CARDS.map((game, index) => (
          <Animated.View key={game.id} entering={FadeInDown.delay(index * 100)}>
            <Pressable onPress={() => setActiveGame(game.id)} style={s.gameCard}>
              <View style={[s.gameCardIcon, { backgroundColor: game.color + '20' }]}>
                <Ionicons name={game.icon} size={30} color={game.color} />
              </View>
              <View style={s.gameCardText}>
                <Text style={s.gameCardTitle}>{game.title}</Text>
                <Text style={s.gameCardDesc}>{game.desc}</Text>
              </View>
              <View style={[s.rewardBadge, { backgroundColor: game.color + '22' }]}>
                <Text style={[s.rewardText, { color: game.color }]}>+{game.reward}px</Text>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </Container>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hubHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  hubTitle: { ...typography.h1, color: colors.text },
  hubSubtitle: { ...typography.body, color: colors.textMuted, marginTop: 2 },
  hubList: { padding: spacing.lg, gap: spacing.md },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    ...shadows.md,
  },
  gameCardIcon: {
    width: 58,
    height: 58,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameCardText: { flex: 1 },
  gameCardTitle: { ...typography.h4, color: colors.text },
  gameCardDesc: { ...typography.small, color: colors.textMuted, marginTop: 2, lineHeight: 16 },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameTitle: { ...typography.h2, color: colors.text, flex: 1 },
  rewardBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  rewardText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  gameContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  startContainer: { alignItems: 'center', gap: spacing.md, maxWidth: 300 },
  gameIconBg: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameDescTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  gameDesc: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  startButton: { width: 200, marginTop: spacing.xs },
  gameBoard: { alignItems: 'center', width: '100%' },
  patternSection: { alignItems: 'center', marginBottom: spacing.xs },
  sectionLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tile: { borderRadius: borderRadius.sm },
  winBanner: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...shadows.lg,
  },
  winText: { ...typography.h3, color: '#FFD700', fontWeight: 'bold' },
  flashContainer: { alignItems: 'center', gap: spacing.lg },
  flashLabel: { ...typography.h3, color: colors.text, textAlign: 'center' },
  flashColor: { width: 150, height: 150, borderRadius: borderRadius.xl, ...shadows.xl },
  roundIndicator: { ...typography.caption, color: colors.textMuted },
  pickContainer: { alignItems: 'center', gap: spacing.md },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
    width: 220,
  },
  optionColor: {
    width: 88,
    height: 88,
    borderRadius: borderRadius.lg,
    ...shadows.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  feedbackText: { ...typography.h4, marginTop: spacing.sm },
  endContainer: { alignItems: 'center', gap: spacing.md },
  winBigText: { ...typography.h1, color: colors.text },
  winSubText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  huntContainer: { alignItems: 'center', gap: spacing.md, width: '100%' },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  huntTarget: { width: 48, height: 48, borderRadius: borderRadius.md, ...shadows.md },
  scoreText: { ...typography.h1, color: colors.text },
  huntGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    width: 248,
    justifyContent: 'center',
  },
  huntTile: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  huntHint: { ...typography.small, color: colors.textMuted, textAlign: 'center' },
});
