import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { Container, Button } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { safeDbUpdateUserPixels } from '@/lib/api';
import { getUserId } from '@/lib/user';
import { MOOD_COLORS } from '@/lib/themes';

type GameId = 'pixel_match' | 'color_flash' | 'pixel_hunt' | 'farbsequenz' | 'farb_mix' | 'stroop' | 'farb_gedachtnis';

// ── Rewards ──────────────────────────────────────────────────────────────────
const REWARDS = {
  pixel_match: 25,
  color_flash: 15,
  pixel_hunt: 20,
  farbsequenz: 20,
  farb_mix: 15,
  stroop: 25,
  farb_gedachtnis: 20,
} as const;

// ── Constants ─────────────────────────────────────────────────────────────────
const GRID_SIZE = 3;
const FLASH_COLORS = MOOD_COLORS.slice(0, 8);
const FLASH_ROUNDS = 5;
const FLASH_DURATION = 1600;
const HUNT_COLORS = MOOD_COLORS.slice(0, 6);
const HUNT_TARGET_SCORE = 8;
const HUNT_INTERVAL = 1100;
const HUNT_LIT_DURATION = 750;

const SIMON_COLORS = [
  { color: '#FF4500', label: 'Rot' },
  { color: '#4169E1', label: 'Blau' },
  { color: '#40E0D0', label: 'Grün' },
  { color: '#FFD700', label: 'Gelb' },
];
const SIMON_WIN_ROUNDS = 4;

const MIX_QUESTIONS = [
  { a: '#FF0000', b: '#0000FF', result: '#800080', wrong: ['#FF8C00', '#40E0D0', '#FFB6C1'] },
  { a: '#FF0000', b: '#FFFF00', result: '#FF8C00', wrong: ['#800080', '#40E0D0', '#808080'] },
  { a: '#0000FF', b: '#FFFF00', result: '#228B22', wrong: ['#800080', '#FF8C00', '#FFB6C1'] },
  { a: '#FF0000', b: '#FFFFFF', result: '#FFB6C1', wrong: ['#800080', '#FF8C00', '#808080'] },
  { a: '#000000', b: '#FFFFFF', result: '#808080', wrong: ['#800080', '#FF8C00', '#FFB6C1'] },
  { a: '#0000FF', b: '#00FF00', result: '#008B8B', wrong: ['#800080', '#FF8C00', '#808080'] },
];
const MIX_TARGET = 5;

const STROOP_ITEMS = [
  { word: 'ROT', color: '#FF4500' },
  { word: 'BLAU', color: '#4169E1' },
  { word: 'GRÜN', color: '#40E0D0' },
  { word: 'GELB', color: '#FFD700' },
  { word: 'LILA', color: '#8A2BE2' },
];
const STROOP_TARGET = 5;

// ── Shared hook ───────────────────────────────────────────────────────────────
function useRewardMutation(reward: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => safeDbUpdateUserPixels(getUserId(), reward),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users', getUserId()] }),
  });
}

// ── Shared layout pieces ──────────────────────────────────────────────────────
function GameHeader({ title, reward, onBack }: { title: string; reward: number; onBack: () => void }) {
  return (
    <View style={s.gameHeader}>
      <Pressable onPress={onBack} style={s.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={s.gameTitle}>{title}</Text>
      <View style={s.rewardBadge}><Text style={s.rewardText}>+{reward}px</Text></View>
    </View>
  );
}

function StartScreen({ icon, iconBg, title, desc, onStart, label = 'Starten' }: {
  icon: string; iconBg: string; title: string; desc: string; onStart: () => void; label?: string;
}) {
  return (
    <Animated.View entering={FadeInDown} style={s.startContainer}>
      <View style={[s.gameIconBg, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={48} color={iconBg.replace('20', '')} />
      </View>
      <Text style={s.gameDescTitle}>{title}</Text>
      <Text style={s.gameDesc}>{desc}</Text>
      <Button variant="primary" size="lg" onPress={onStart} style={s.startButton}>{label}</Button>
    </Animated.View>
  );
}

function WinLoseScreen({ won, reward, onReset }: { won: boolean; reward: number; onReset: () => void }) {
  return (
    <Animated.View entering={FadeInUp} style={s.endContainer}>
      <Ionicons name={won ? 'trophy' : 'close-circle'} size={72} color={won ? '#FFD700' : '#EF4444'} />
      <Text style={s.winBigText}>{won ? 'Gewonnen!' : 'Falsch!'}</Text>
      <Text style={s.winSubText}>{won ? `+${reward} Pixels verdient` : 'Versuche es nochmal.'}</Text>
      <Button variant="primary" onPress={onReset} style={s.startButton}>Nochmal</Button>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME 1: PIXEL MATCH
// ═══════════════════════════════════════════════════════════════════════════════
function PixelMatchGame({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const tileSize = Math.floor((Math.min(width, 480) - spacing.xl * 2 - spacing.sm * (GRID_SIZE - 1)) / GRID_SIZE);
  const [targetPattern, setTargetPattern] = useState<string[]>([]);
  const [userPattern, setUserPattern] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const rewardMutation = useRewardMutation(REWARDS.pixel_match);
  const winScale = useSharedValue(1);
  const animatedWinStyle = useAnimatedStyle(() => ({ transform: [{ scale: winScale.value }] }));

  const generatePattern = useCallback(() => {
    const p = Array.from({ length: GRID_SIZE * GRID_SIZE }, () =>
      MOOD_COLORS[Math.floor(Math.random() * MOOD_COLORS.length)].color
    );
    setTargetPattern(p);
    setUserPattern(new Array(GRID_SIZE * GRID_SIZE).fill(MOOD_COLORS[0].color));
    setIsPlaying(true);
    setHasWon(false);
  }, []);

  const handleTilePress = (index: number) => {
    if (!isPlaying || hasWon) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = [...userPattern];
    const ci = MOOD_COLORS.findIndex(m => m.color === next[index]);
    next[index] = MOOD_COLORS[(ci + 1) % MOOD_COLORS.length].color;
    setUserPattern(next);
    if (next.every((c, i) => c === targetPattern[i])) {
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
      <GameHeader title="Muster-Match" reward={REWARDS.pixel_match} onBack={onBack} />
      <View style={s.gameContent}>
        {!isPlaying && !hasWon ? (
          <StartScreen
            icon="grid" iconBg="#7C3AED20" title="Muster-Match"
            desc="Tippe auf die Felder, um ihre Farbe zu wechseln und das Zielmuster zu kopieren."
            onStart={generatePattern} label="Spiel starten"
          />
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
                  <Pressable key={i} onPress={() => handleTilePress(i)}
                    style={[s.tile, { width: tileSize, height: tileSize, backgroundColor: color, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }]} />
                ))}
              </View>
            </Animated.View>
            {hasWon && (
              <Animated.View entering={FadeInUp} style={s.winBanner}>
                <Ionicons name="trophy" size={24} color="#FFD700" />
                <Text style={s.winText}>+{REWARDS.pixel_match} Pixels!</Text>
                <Button variant="outline" size="sm" onPress={generatePattern}>Nochmal</Button>
              </Animated.View>
            )}
          </View>
        )}
      </View>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME 2: COLOR FLASH
// ═══════════════════════════════════════════════════════════════════════════════
function ColorFlashGame({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'show' | 'pick' | 'won' | 'lost'>('idle');
  const [round, setRound] = useState(0);
  const [targetColor, setTargetColor] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<boolean | null>(null);
  const rewardMutation = useRewardMutation(REWARDS.color_flash);
  const timerRef = useRef<any>(null);

  const startRound = useCallback((r: number) => {
    const target = FLASH_COLORS[Math.floor(Math.random() * FLASH_COLORS.length)];
    setTargetColor(target.color);
    setPhase('show');
    setLastResult(null);
    timerRef.current = setTimeout(() => {
      const others = FLASH_COLORS.filter(c => c.color !== target.color).sort(() => Math.random() - 0.5).slice(0, 3).map(c => c.color);
      setOptions([...others, target.color].sort(() => Math.random() - 0.5));
      setPhase('pick');
    }, FLASH_DURATION);
  }, []);

  const handlePick = (color: string) => {
    const correct = color === targetColor;
    setLastResult(correct);
    if (Platform.OS !== 'web') {
      correct ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    if (correct) {
      const next = round + 1;
      setRound(next);
      if (next >= FLASH_ROUNDS) { setPhase('won'); rewardMutation.mutate(); }
      else setTimeout(() => startRound(next), 700);
    } else { setPhase('lost'); }
  };

  const reset = () => { setRound(0); setLastResult(null); setPhase('idle'); };

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <GameHeader title="Farbblitz" reward={REWARDS.color_flash} onBack={onBack} />
      <View style={s.gameContent}>
        {phase === 'idle' && (
          <StartScreen icon="flash" iconBg="#10B98120" title="Farbblitz"
            desc={`Eine Farbe blitzt kurz auf. Merke sie dir und wähle sie aus 4 Optionen. ${FLASH_ROUNDS} richtige = Sieg!`}
            onStart={() => { setRound(0); startRound(0); }} />
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
                <Pressable key={i} onPress={() => handlePick(color)} style={[s.optionColor, { backgroundColor: color }]} />
              ))}
            </View>
            {lastResult !== null && (
              <Text style={[s.feedbackText, { color: lastResult ? '#10B981' : '#EF4444' }]}>
                {lastResult ? '✓ Richtig!' : '✗ Falsch!'}
              </Text>
            )}
          </Animated.View>
        )}
        {(phase === 'won' || phase === 'lost') && <WinLoseScreen won={phase === 'won'} reward={REWARDS.color_flash} onReset={reset} />}
      </View>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME 3: PIXEL HUNT
// ═══════════════════════════════════════════════════════════════════════════════
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
  const rewardMutation = useRewardMutation(REWARDS.pixel_hunt);

  const stopGame = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (litTimerRef.current) clearTimeout(litTimerRef.current);
  }, []);

  const startGame = useCallback(() => {
    const newTarget = HUNT_COLORS[Math.floor(Math.random() * HUNT_COLORS.length)];
    setTargetColor(newTarget.color);
    targetColorRef.current = newTarget.color;
    setScore(0); scoreRef.current = 0;
    setActiveTile(null);
    setGameState('playing');
    intervalRef.current = setInterval(() => {
      const tileIndex = Math.floor(Math.random() * 9);
      const useTarget = Math.random() < 0.55;
      const wrongColors = HUNT_COLORS.filter(c => c.color !== targetColorRef.current);
      const color = useTarget ? targetColorRef.current : wrongColors[Math.floor(Math.random() * wrongColors.length)].color;
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
      const ns = scoreRef.current + 1;
      scoreRef.current = ns;
      setScore(ns);
      setActiveTile(null);
      if (ns >= HUNT_TARGET_SCORE) {
        stopGame(); setGameState('won'); rewardMutation.mutate();
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [gameState, activeTile, activeTileColor, stopGame]);

  const reset = () => { stopGame(); setScore(0); setActiveTile(null); setGameState('idle'); };

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <GameHeader title="Pixel-Jagd" reward={REWARDS.pixel_hunt} onBack={() => { stopGame(); onBack(); }} />
      <View style={s.gameContent}>
        {gameState === 'idle' && (
          <StartScreen icon="locate" iconBg="#F59E0B20" title="Pixel-Jagd"
            desc={`Ein Feld leuchtet auf! Tippe es nur wenn es die Zielfarbe zeigt. ${HUNT_TARGET_SCORE} richtige Treffer = Sieg!`}
            onStart={startGame} label="Jagen!" />
        )}
        {gameState === 'playing' && (
          <View style={s.huntContainer}>
            <View style={s.targetRow}>
              <Text style={s.sectionLabel}>Zielfarbe:</Text>
              <View style={[s.huntTarget, { backgroundColor: targetColor }]} />
            </View>
            <Text style={s.scoreText}>{score} / {HUNT_TARGET_SCORE}</Text>
            <View style={s.huntGrid}>
              {Array.from({ length: 9 }).map((_, i) => (
                <Pressable key={i} onPress={() => handleTilePress(i)}
                  style={[s.huntTile, activeTile === i
                    ? { backgroundColor: activeTileColor, borderColor: 'rgba(255,255,255,0.3)' }
                    : { backgroundColor: colors.surface }
                  ]} />
              ))}
            </View>
            <Text style={s.huntHint}>Tippe nur auf die Zielfarbe!</Text>
          </View>
        )}
        {gameState === 'won' && <WinLoseScreen won reward={REWARDS.pixel_hunt} onReset={reset} />}
      </View>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME 4: FARBSEQUENZ (Simon Says)
// ═══════════════════════════════════════════════════════════════════════════════
function FarbsequenzGame({ onBack }: { onBack: () => void }) {
  const [sequence, setSequence] = useState<string[]>([]);
  const [phase, setPhase] = useState<'idle' | 'showing' | 'input' | 'won' | 'lost'>('idle');
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [userInput, setUserInput] = useState<string[]>([]);
  const [round, setRound] = useState(0);
  const seqRef = useRef<string[]>([]);
  const roundRef = useRef(0);
  const rewardMutation = useRewardMutation(REWARDS.farbsequenz);

  const showStep = useCallback((seq: string[], index: number) => {
    if (index >= seq.length) {
      setTimeout(() => { setHighlighted(null); setPhase('input'); }, 300);
      return;
    }
    setTimeout(() => {
      setHighlighted(seq[index]);
      setTimeout(() => {
        setHighlighted(null);
        showStep(seq, index + 1);
      }, 550);
    }, 300);
  }, []);

  const startRound = useCallback((prevSeq: string[], r: number) => {
    const newColor = SIMON_COLORS[Math.floor(Math.random() * SIMON_COLORS.length)].color;
    const newSeq = [...prevSeq, newColor];
    seqRef.current = newSeq;
    roundRef.current = r;
    setSequence(newSeq);
    setUserInput([]);
    setRound(r);
    setPhase('showing');
    setTimeout(() => showStep(newSeq, 0), 500);
  }, [showStep]);

  const startGame = useCallback(() => {
    startRound([], 1);
  }, [startRound]);

  const handleColorPress = (color: string) => {
    if (phase !== 'input') return;
    setHighlighted(color);
    setTimeout(() => setHighlighted(null), 180);
    const newInput = [...userInput, color];
    const idx = newInput.length - 1;
    if (color !== seqRef.current[idx]) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPhase('lost');
      return;
    }
    setUserInput(newInput);
    if (newInput.length === seqRef.current.length) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (roundRef.current >= SIMON_WIN_ROUNDS) {
        setPhase('won');
        rewardMutation.mutate();
      } else {
        setTimeout(() => startRound(seqRef.current, roundRef.current + 1), 900);
      }
    }
  };

  const reset = () => { setPhase('idle'); setRound(0); setUserInput([]); setSequence([]); };

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <GameHeader title="Farbsequenz" reward={REWARDS.farbsequenz} onBack={onBack} />
      <View style={s.gameContent}>
        {phase === 'idle' && (
          <StartScreen icon="musical-notes" iconBg="#3B82F620" title="Farbsequenz"
            desc={`Die Felder leuchten in einer Reihenfolge auf. Merke sie dir und tippe sie nach! ${SIMON_WIN_ROUNDS} Runden = Sieg!`}
            onStart={startGame} />
        )}
        {(phase === 'showing' || phase === 'input') && (
          <View style={s.simonContainer}>
            <Text style={s.sectionLabel}>
              {phase === 'showing' ? 'Merke dir die Reihenfolge...' : 'Deine Eingabe!'}
            </Text>
            <Text style={s.roundIndicator}>Runde {round} / {SIMON_WIN_ROUNDS}  •  {userInput.length} / {sequence.length}</Text>
            <View style={s.simonGrid}>
              {SIMON_COLORS.map((item) => (
                <Pressable key={item.color} onPress={() => handleColorPress(item.color)}
                  style={[
                    s.simonButton,
                    { backgroundColor: item.color },
                    highlighted === item.color && s.simonButtonLit,
                    phase === 'showing' && { opacity: 0.6 }
                  ]}>
                  <Text style={s.simonLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {(phase === 'won' || phase === 'lost') && (
          <WinLoseScreen won={phase === 'won'} reward={REWARDS.farbsequenz}
            onReset={reset}
          />
        )}
      </View>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME 5: FARB-MIX (Color Mixing Quiz)
// ═══════════════════════════════════════════════════════════════════════════════
function FarbMixGame({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'playing' | 'feedback' | 'won' | 'lost'>('idle');
  const [score, setScore] = useState(0);
  const [question, setQuestion] = useState(MIX_QUESTIONS[0]);
  const [options, setOptions] = useState<string[]>([]);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const rewardMutation = useRewardMutation(REWARDS.farb_mix);

  const nextQuestion = useCallback(() => {
    const q = MIX_QUESTIONS[Math.floor(Math.random() * MIX_QUESTIONS.length)];
    setQuestion(q);
    setOptions([q.result, ...q.wrong].sort(() => Math.random() - 0.5));
    setLastCorrect(null);
    setPhase('playing');
  }, []);

  const handlePick = (color: string) => {
    const correct = color === question.result;
    setLastCorrect(correct);
    setPhase('feedback');
    if (Platform.OS !== 'web') {
      correct ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    if (correct) {
      const ns = score + 1;
      setScore(ns);
      if (ns >= MIX_TARGET) { setTimeout(() => { setPhase('won'); rewardMutation.mutate(); }, 700); }
      else setTimeout(() => nextQuestion(), 700);
    } else { setTimeout(() => setPhase('lost'), 500); }
  };

  const reset = () => { setScore(0); setPhase('idle'); };

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <GameHeader title="Farb-Mix" reward={REWARDS.farb_mix} onBack={onBack} />
      <View style={s.gameContent}>
        {phase === 'idle' && (
          <StartScreen icon="color-palette" iconBg="#F9731620" title="Farb-Mix"
            desc={`Welche Farbe entsteht durch Mischen der beiden Farben? ${MIX_TARGET} richtige = Sieg!`}
            onStart={() => { setScore(0); nextQuestion(); }} />
        )}
        {(phase === 'playing' || phase === 'feedback') && (
          <View style={s.mixContainer}>
            <Text style={s.scoreIndicator}>{score} / {MIX_TARGET}</Text>
            <View style={s.mixRow}>
              <View style={[s.mixSwatch, { backgroundColor: question.a }]} />
              <Text style={s.mixOp}>+</Text>
              <View style={[s.mixSwatch, { backgroundColor: question.b }]} />
              <Text style={s.mixOp}>=</Text>
              <View style={[s.mixSwatch, { backgroundColor: colors.surface }]}>
                <Text style={s.mixQ}>?</Text>
              </View>
            </View>
            <Text style={s.flashLabel}>Was ergibt die Mischung?</Text>
            <View style={s.optionsGrid}>
              {options.map((color, i) => (
                <Pressable key={i} onPress={() => phase === 'playing' && handlePick(color)}
                  style={[
                    s.optionColor,
                    { backgroundColor: color },
                    phase === 'feedback' && color === question.result && { borderColor: '#10B981', borderWidth: 3 }
                  ]} />
              ))}
            </View>
            {lastCorrect !== null && (
              <Text style={[s.feedbackText, { color: lastCorrect ? '#10B981' : '#EF4444' }]}>
                {lastCorrect ? '✓ Richtig!' : '✗ Falsch!'}
              </Text>
            )}
          </View>
        )}
        {(phase === 'won' || phase === 'lost') && <WinLoseScreen won={phase === 'won'} reward={REWARDS.farb_mix} onReset={reset} />}
      </View>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME 6: STROOP TEST
// ═══════════════════════════════════════════════════════════════════════════════
function StroopGame({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'playing' | 'feedback' | 'won' | 'lost'>('idle');
  const [score, setScore] = useState(0);
  const [wordItem, setWordItem] = useState(STROOP_ITEMS[0]);
  const [inkColor, setInkColor] = useState(STROOP_ITEMS[1].color);
  const [options, setOptions] = useState<typeof STROOP_ITEMS>([]);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const rewardMutation = useRewardMutation(REWARDS.stroop);

  const nextRound = useCallback(() => {
    const word = STROOP_ITEMS[Math.floor(Math.random() * STROOP_ITEMS.length)];
    const others = STROOP_ITEMS.filter(i => i.color !== word.color);
    const ink = others[Math.floor(Math.random() * others.length)];
    setWordItem(word);
    setInkColor(ink.color);
    setOptions([...STROOP_ITEMS].sort(() => Math.random() - 0.5));
    setLastCorrect(null);
    setPhase('playing');
  }, []);

  const handlePick = (color: string) => {
    const correct = color === inkColor;
    setLastCorrect(correct);
    setPhase('feedback');
    if (Platform.OS !== 'web') {
      correct ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    if (correct) {
      const ns = score + 1;
      setScore(ns);
      if (ns >= STROOP_TARGET) { setTimeout(() => { setPhase('won'); rewardMutation.mutate(); }, 700); }
      else setTimeout(() => nextRound(), 700);
    } else { setTimeout(() => setPhase('lost'), 500); }
  };

  const reset = () => { setScore(0); setPhase('idle'); };

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <GameHeader title="Stroop-Test" reward={REWARDS.stroop} onBack={onBack} />
      <View style={s.gameContent}>
        {phase === 'idle' && (
          <StartScreen icon="eye" iconBg="#EC489920" title="Stroop-Test"
            desc="Ein Wort erscheint in einer Farbe. Tippe auf die FARBE der Schrift — nicht auf die Bedeutung des Wortes!"
            onStart={() => { setScore(0); nextRound(); }} />
        )}
        {(phase === 'playing' || phase === 'feedback') && (
          <View style={s.stroopContainer}>
            <Text style={s.scoreIndicator}>{score} / {STROOP_TARGET}</Text>
            <Text style={[s.stroopWord, { color: inkColor }]}>{wordItem.word}</Text>
            <Text style={s.stroopQuestion}>Welche FARBE siehst du?</Text>
            <View style={s.stroopOptions}>
              {options.map((opt, i) => (
                <Pressable key={i} onPress={() => phase === 'playing' && handlePick(opt.color)}
                  style={[
                    s.stroopOption,
                    phase === 'feedback' && opt.color === inkColor && { borderColor: '#10B981', borderWidth: 2 }
                  ]}>
                  <View style={[s.stroopDot, { backgroundColor: opt.color }]} />
                  <Text style={s.stroopOptionText}>{opt.word}</Text>
                </Pressable>
              ))}
            </View>
            {lastCorrect !== null && (
              <Text style={[s.feedbackText, { color: lastCorrect ? '#10B981' : '#EF4444' }]}>
                {lastCorrect ? '✓ Richtig!' : '✗ Falsch!'}
              </Text>
            )}
          </View>
        )}
        {(phase === 'won' || phase === 'lost') && <WinLoseScreen won={phase === 'won'} reward={REWARDS.stroop} onReset={reset} />}
      </View>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME 7: FARB-GEDÄCHTNIS (Color Memory)
// ═══════════════════════════════════════════════════════════════════════════════
const MEMORY_PAIR_COLORS = MOOD_COLORS.slice(0, 8).map(m => m.color);

type MemoryCard = { id: number; color: string; isFlipped: boolean; isMatched: boolean };

function FarbGedachtnisGame({ onBack }: { onBack: () => void }) {
  const { width } = useWindowDimensions();
  const cardSize = Math.floor((Math.min(width, 420) - spacing.xl * 2 - spacing.sm * 3) / 4);

  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [phase, setPhase] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const lockRef = useRef(false);
  const pendingIdRef = useRef<number | null>(null);
  const pendingColorRef = useRef<string | null>(null);
  const timerRef = useRef<any>(null);
  const rewardMutation = useRewardMutation(REWARDS.farb_gedachtnis);

  const initGame = useCallback(() => {
    const deck: MemoryCard[] = [...MEMORY_PAIR_COLORS, ...MEMORY_PAIR_COLORS]
      .sort(() => Math.random() - 0.5)
      .map((color, i) => ({ id: i, color, isFlipped: false, isMatched: false }));
    setCards(deck);
    setMoves(0);
    setTimeLeft(60);
    lockRef.current = false;
    pendingIdRef.current = null;
    pendingColorRef.current = null;
    setPhase('playing');
  }, []);

  useEffect(() => {
    if (phase !== 'playing') { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setPhase('lost'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' && cards.length > 0 && cards.every(c => c.isMatched)) {
      clearInterval(timerRef.current);
      setPhase('won');
      rewardMutation.mutate();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [cards, phase]);

  const handleCardPress = useCallback((card: MemoryCard) => {
    if (phase !== 'playing' || lockRef.current || card.isFlipped || card.isMatched) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setCards(prev => prev.map(c => c.id === card.id ? { ...c, isFlipped: true } : c));

    if (pendingIdRef.current === null) {
      pendingIdRef.current = card.id;
      pendingColorRef.current = card.color;
    } else {
      const firstId = pendingIdRef.current;
      const firstColor = pendingColorRef.current;
      pendingIdRef.current = null;
      pendingColorRef.current = null;
      setMoves(m => m + 1);
      lockRef.current = true;

      if (firstColor === card.color && firstId !== card.id) {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCards(prev => prev.map(c =>
          c.id === firstId || c.id === card.id ? { ...c, isFlipped: true, isMatched: true } : c
        ));
        lockRef.current = false;
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === firstId || c.id === card.id ? { ...c, isFlipped: false } : c
          ));
          lockRef.current = false;
        }, 700);
      }
    }
  }, [phase]);

  const reset = () => { clearInterval(timerRef.current); setPhase('idle'); setCards([]); };

  const matchedCount = cards.filter(c => c.isMatched).length / 2;

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <GameHeader title="Farb-Gedächtnis" reward={REWARDS.farb_gedachtnis} onBack={() => { clearInterval(timerRef.current); onBack(); }} />
      <View style={s.gameContent}>
        {phase === 'idle' && (
          <StartScreen icon="albums" iconBg="#06B6D420" title="Farb-Gedächtnis"
            desc="Finde alle 8 Farbpaare! Tippe zwei Karten auf — stimmen die Farben überein, bleiben sie aufgedeckt. Du hast 60 Sekunden."
            onStart={initGame} />
        )}
        {(phase === 'playing') && (
          <View style={s.memoryContainer}>
            <View style={s.memoryStats}>
              <View style={s.memoryStatChip}>
                <Ionicons name="time-outline" size={14} color={timeLeft <= 10 ? '#EF4444' : colors.textMuted} />
                <Text style={[s.memoryStatText, timeLeft <= 10 && { color: '#EF4444' }]}>{timeLeft}s</Text>
              </View>
              <View style={s.memoryStatChip}>
                <Ionicons name="checkmark-circle-outline" size={14} color={colors.textMuted} />
                <Text style={s.memoryStatText}>{matchedCount} / 8</Text>
              </View>
              <View style={s.memoryStatChip}>
                <Ionicons name="swap-horizontal-outline" size={14} color={colors.textMuted} />
                <Text style={s.memoryStatText}>{moves}</Text>
              </View>
            </View>
            <View style={s.memoryGrid}>
              {cards.map(card => (
                <Pressable key={card.id} onPress={() => handleCardPress(card)}
                  style={[
                    s.memoryCard,
                    { width: cardSize, height: cardSize },
                    card.isFlipped || card.isMatched
                      ? { backgroundColor: card.color }
                      : { backgroundColor: colors.surface },
                    card.isMatched && { opacity: 0.7 },
                  ]}>
                  {(card.isFlipped || card.isMatched) ? (
                    card.isMatched
                      ? <Ionicons name="checkmark" size={cardSize * 0.4} color="rgba(255,255,255,0.9)" />
                      : null
                  ) : (
                    <Ionicons name="help" size={cardSize * 0.35} color="rgba(255,255,255,0.15)" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {(phase === 'won' || phase === 'lost') && (
          <Animated.View entering={FadeInUp} style={s.endContainer}>
            <Ionicons name={phase === 'won' ? 'trophy' : 'time'} size={72} color={phase === 'won' ? '#FFD700' : '#EF4444'} />
            <Text style={s.winBigText}>{phase === 'won' ? 'Gewonnen!' : 'Zeit abgelaufen!'}</Text>
            <Text style={s.winSubText}>
              {phase === 'won'
                ? `+${REWARDS.farb_gedachtnis} Pixels in ${moves} Zügen!`
                : `${matchedCount} von 8 Paaren gefunden.`}
            </Text>
            <Button variant="primary" onPress={reset} style={s.startButton}>Nochmal</Button>
          </Animated.View>
        )}
      </View>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME HUB
// ═══════════════════════════════════════════════════════════════════════════════
const GAME_CARDS: { id: GameId; icon: string; color: string; title: string; desc: string }[] = [
  { id: 'pixel_match', icon: 'grid', color: '#7C3AED', title: 'Muster-Match', desc: 'Kopiere das Farbmuster durch Antippen der Felder.' },
  { id: 'color_flash', icon: 'flash', color: '#10B981', title: 'Farbblitz', desc: 'Merke dir die aufblitzende Farbe und wähle sie aus.' },
  { id: 'pixel_hunt', icon: 'locate', color: '#F59E0B', title: 'Pixel-Jagd', desc: 'Tippe schnell auf das Feld mit der richtigen Farbe!' },
  { id: 'farbsequenz', icon: 'musical-notes', color: '#3B82F6', title: 'Farbsequenz', desc: 'Simon Says mit Farben — merke dir die Reihenfolge!' },
  { id: 'farb_mix', icon: 'color-palette', color: '#F97316', title: 'Farb-Mix', desc: 'Welche Farbe entsteht aus der Mischung? Errate es!' },
  { id: 'stroop', icon: 'eye', color: '#EC4899', title: 'Stroop-Test', desc: 'Tippe auf die Farbe der Schrift — nicht das Wort!' },
  { id: 'farb_gedachtnis', icon: 'albums', color: '#06B6D4', title: 'Farb-Gedächtnis', desc: 'Decke Kartenpaare auf und finde alle 8 Farbpaare!' },
];

export default function GamesScreen() {
  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const back = () => setActiveGame(null);

  if (activeGame === 'pixel_match') return <PixelMatchGame onBack={back} />;
  if (activeGame === 'color_flash') return <ColorFlashGame onBack={back} />;
  if (activeGame === 'pixel_hunt') return <PixelHuntGame onBack={back} />;
  if (activeGame === 'farbsequenz') return <FarbsequenzGame onBack={back} />;
  if (activeGame === 'farb_mix') return <FarbMixGame onBack={back} />;
  if (activeGame === 'stroop') return <StroopGame onBack={back} />;
  if (activeGame === 'farb_gedachtnis') return <FarbGedachtnisGame onBack={back} />;

  return (
    <Container safeArea edges={['top']} style={s.container}>
      <View style={s.hubHeader}>
        <Text style={s.hubTitle}>Spiele</Text>
        <Text style={s.hubSubtitle}>Verdiene Pixels mit Mini-Spielen.</Text>
      </View>
      <ScrollView contentContainerStyle={s.hubList} showsVerticalScrollIndicator={false}>
        {GAME_CARDS.map((game, index) => (
          <Animated.View key={game.id} entering={FadeInDown.delay(index * 60)}>
            <Pressable onPress={() => setActiveGame(game.id)} style={s.gameCard}>
              <View style={[s.gameCardIcon, { backgroundColor: game.color + '22' }]}>
                <Ionicons name={game.icon as any} size={28} color={game.color} />
              </View>
              <View style={s.gameCardText}>
                <Text style={s.gameCardTitle}>{game.title}</Text>
                <Text style={s.gameCardDesc}>{game.desc}</Text>
              </View>
              <View style={[s.rewardBadge, { backgroundColor: game.color + '22' }]}>
                <Text style={[s.rewardText, { color: game.color }]}>+{REWARDS[game.id]}px</Text>
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </Container>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Hub
  hubHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  hubTitle: { ...typography.h1, color: colors.text },
  hubSubtitle: { ...typography.body, color: colors.textMuted, marginTop: 2 },
  hubList: { padding: spacing.lg, gap: spacing.sm },
  gameCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.xl, padding: spacing.md, gap: spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', ...shadows.md,
  },
  gameCardIcon: { width: 52, height: 52, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  gameCardText: { flex: 1 },
  gameCardTitle: { ...typography.h4, color: colors.text },
  gameCardDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2, lineHeight: 16 },

  // Shared game chrome
  gameHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  gameTitle: { ...typography.h2, color: colors.text, flex: 1 },
  rewardBadge: { backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full },
  rewardText: { fontSize: 12, color: colors.primary, fontWeight: '700' },
  gameContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  startContainer: { alignItems: 'center', gap: spacing.md, maxWidth: 300 },
  gameIconBg: { width: 88, height: 88, borderRadius: borderRadius.xxl, justifyContent: 'center', alignItems: 'center' },
  gameDescTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  gameDesc: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  startButton: { width: 200, marginTop: spacing.xs },
  endContainer: { alignItems: 'center', gap: spacing.md },
  winBigText: { ...typography.h1, color: colors.text },
  winSubText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  feedbackText: { ...typography.h4, marginTop: spacing.sm },
  sectionLabel: { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: spacing.xs },
  roundIndicator: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  scoreIndicator: { ...typography.h4, color: colors.textMuted, marginBottom: spacing.sm },

  // Pixel Match
  gameBoard: { alignItems: 'center', width: '100%' },
  patternSection: { alignItems: 'center', marginBottom: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  tile: { borderRadius: borderRadius.sm },
  winBanner: {
    marginTop: spacing.lg, backgroundColor: colors.surface, padding: spacing.lg,
    borderRadius: borderRadius.xl, alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', ...shadows.lg,
  },
  winText: { ...typography.h3, color: '#FFD700', fontWeight: 'bold' },

  // Color Flash / Farb-Mix shared
  flashContainer: { alignItems: 'center', gap: spacing.lg },
  flashLabel: { ...typography.h3, color: colors.text, textAlign: 'center' },
  flashColor: { width: 150, height: 150, borderRadius: borderRadius.xl, ...shadows.xl },
  pickContainer: { alignItems: 'center', gap: spacing.md },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', width: 220 },
  optionColor: { width: 88, height: 88, borderRadius: borderRadius.lg, ...shadows.md, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },

  // Pixel Hunt
  huntContainer: { alignItems: 'center', gap: spacing.md, width: '100%' },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  huntTarget: { width: 48, height: 48, borderRadius: borderRadius.md, ...shadows.md },
  scoreText: { ...typography.h1, color: colors.text },
  huntGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, width: 248, justifyContent: 'center' },
  huntTile: { width: 72, height: 72, borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  huntHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  // Farbsequenz (Simon Says)
  simonContainer: { alignItems: 'center', gap: spacing.sm, width: '100%' },
  simonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center', width: 260 },
  simonButton: { width: 116, height: 116, borderRadius: borderRadius.xl, justifyContent: 'center', alignItems: 'center', ...shadows.md },
  simonButtonLit: { transform: [{ scale: 1.1 }], ...shadows.xl },
  simonLabel: { fontSize: 14, fontWeight: '700', color: 'rgba(0,0,0,0.6)' },

  // Farb-Mix
  mixContainer: { alignItems: 'center', gap: spacing.md, width: '100%' },
  mixRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mixSwatch: { width: 64, height: 64, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', ...shadows.md },
  mixOp: { ...typography.h2, color: colors.text },
  mixQ: { fontSize: 28, color: colors.text },

  // Stroop
  stroopContainer: { alignItems: 'center', gap: spacing.md, width: '100%' },
  stroopWord: { fontSize: 56, fontWeight: '900', letterSpacing: 4 },
  stroopQuestion: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  stroopOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', width: 300 },
  stroopOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg, width: 138, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  stroopDot: { width: 20, height: 20, borderRadius: 10 },
  stroopOptionText: { ...typography.captionBold, color: colors.text },

  // Farb-Gedächtnis (Memory)
  memoryContainer: { alignItems: 'center', gap: spacing.md, width: '100%' },
  memoryStats: { flexDirection: 'row', gap: spacing.sm },
  memoryStatChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  memoryStatText: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  memoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
    justifyContent: 'center',
  },
  memoryCard: {
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...shadows.sm,
  },
});
