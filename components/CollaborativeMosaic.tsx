import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { Svg, Rect } from 'react-native-svg';
import { colors, spacing, typography, borderRadius } from '@/constants/design';
import { safeDbUpdateUserPixels, safeDbGet } from '@/lib/api';
import { blink } from '@/lib/blink';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { useDiscoStore } from '@/lib/store';

const CANVAS_SIZE = 64;
const STORAGE_KEY = 'monsaik_canvas_v1';
const BALANCE_KEY = 'monsaik_balance_v1';

const PALETTE_SCHEMES = {
  vibrant: [
    '#FFD700', '#40E0D0', '#FF4500', '#4169E1', '#8A2BE2', '#FF1493',
    '#ADFF2F', '#708090', '#FF8C00', '#00CED1', '#8B4513', '#000000',
    '#FFFFFF', '#FFB6C1', '#00FF00', '#FF0000', '#0000FF', '#FFFF00',
  ],
  pastel: [
    '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA', '#E0BBE4',
    '#FFC8A2', '#D5AAFF', '#B2E2F2', '#EAD1DC', '#F4CCCC', '#D9D9D9',
    '#FFF2CC', '#D9EAD3', '#CFE2F3', '#D9D2E9', '#FCE5CD', '#EFEFEF',
  ],
  neon: [
    '#39FF14', '#FF00FF', '#00FFFF', '#FFFF00', '#FF3131', '#00FF00',
    '#BC13FE', '#FFEA00', '#1F51FF', '#FF007F', '#0FF0FC', '#FFFFFF',
    '#B5FF00', '#FF00E0', '#000000', '#FFBD00', '#FF5E00', '#006BFF',
  ]
};

const DISCO_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

// ─── Local storage helpers ────────────────────────────────────────────────────
function loadCanvas(): Record<string, string> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    }
  } catch {}
  return {};
}

function saveCanvas(pixels: Record<string, string>) {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pixels));
    }
  } catch {}
}

function loadLocalBalance(): number | null {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(BALANCE_KEY);
      return raw !== null ? parseInt(raw, 10) : null;
    }
  } catch {}
  return null;
}

function saveLocalBalance(n: number) {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(BALANCE_KEY, String(n));
    }
  } catch {}
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CollaborativeMosaic() {
  const { width: screenWidth } = useWindowDimensions();
  const canvasPadding = spacing.md * 2;
  const pixelSize = Math.max(1, (screenWidth - canvasPadding) / CANVAS_SIZE);
  const totalWidth = CANVAS_SIZE * pixelSize;

  const [pixels, setPixels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [scheme, setScheme] = useState<keyof typeof PALETTE_SCHEMES>('vibrant');
  const palette = PALETTE_SCHEMES[scheme];
  const [selectedColor, setSelectedColor] = useState(palette[0]);
  const [userPixels, setUserPixels] = useState(50);
  const [discoTick, setDiscoTick] = useState(0);

  const channelRef = useRef<any>(null);
  const canvasRef = useRef<View>(null);
  const canvasPosRef = useRef({ x: 0, y: 0 });
  const pixelsRef = useRef<Record<string, string>>({});
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { isDiscoEnabled } = useDiscoStore();

  // Keep ref in sync for use inside realtime callbacks
  useEffect(() => { pixelsRef.current = pixels; }, [pixels]);

  useEffect(() => {
    if (!isDiscoEnabled) return;
    const interval = setInterval(() => {
      setDiscoTick(prev => (prev + 1) % DISCO_COLORS.length);
    }, 400);
    return () => clearInterval(interval);
  }, [isDiscoEnabled]);

  const getDiscoColor = useCallback((x: number, y: number) => {
    if (!isDiscoEnabled) return undefined;
    return DISCO_COLORS[(discoTick + (x + y)) % DISCO_COLORS.length];
  }, [isDiscoEnabled, discoTick]);

  // ── Load canvas + user balance on mount ──────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // Load canvas from localStorage
      const stored = loadCanvas();
      setPixels(stored);
      pixelsRef.current = stored;

      // Load pixel balance: prefer DB, fall back to localStorage, then default 50
      try {
        const userRes = await safeDbGet('users', 'current_user');
        const dbBalance = (userRes as any)?.pixelBalance;
        if (typeof dbBalance === 'number') {
          setUserPixels(dbBalance);
          saveLocalBalance(dbBalance);
        } else {
          const local = loadLocalBalance();
          setUserPixels(local !== null ? local : 50);
        }
      } catch {
        const local = loadLocalBalance();
        setUserPixels(local !== null ? local : 50);
      }

      setLoading(false);
    };

    init();

    // ── Realtime: subscribe & handle peer messages ───────────────────────
    const initRealtime = async () => {
      try {
        if (!blink?.realtime || typeof blink.realtime.channel !== 'function') return;
        const channel = blink.realtime.channel('global-mosaic');
        channelRef.current = channel;
        await channel.subscribe({ userId: 'current_user' });

        channel.onMessage((msg: any) => {
          if (msg.type === 'pixel_update') {
            const { x, y, color } = msg.data ?? {};
            if (typeof x === 'number' && typeof y === 'number' && color) {
              setPixels(prev => {
                const next = { ...prev, [`${x}_${y}`]: color };
                saveCanvas(next);
                return next;
              });
            }
          } else if (msg.type === 'request_canvas') {
            // Another peer is asking for the current canvas — send our localStorage copy
            const snapshot = pixelsRef.current;
            if (Object.keys(snapshot).length > 0 && channelRef.current) {
              channelRef.current.publish(
                'canvas_snapshot',
                { pixels: snapshot },
                { userId: 'current_user' }
              );
            }
          } else if (msg.type === 'canvas_snapshot') {
            // Received a full canvas snapshot from a peer — merge it
            const peerPixels = msg.data?.pixels;
            if (peerPixels && typeof peerPixels === 'object') {
              setPixels(prev => {
                const merged = { ...peerPixels, ...prev }; // local takes precedence
                saveCanvas(merged);
                return merged;
              });
            }
          }
        });

        // Ask peers for their canvas if our local one is empty
        const stored = loadCanvas();
        if (Object.keys(stored).length === 0) {
          setTimeout(() => {
            channelRef.current?.publish('request_canvas', {}, { userId: 'current_user' });
          }, 500);
        }
      } catch (err) {
        console.warn('[MONSAIK] Realtime mosaic unavailable:', err);
      }
    };

    initRealtime();
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  useEffect(() => {
    setSelectedColor(palette[0]);
  }, [scheme]);

  // ── Measure canvas position for web coordinate fallback ──────────────────
  const measureCanvas = useCallback(() => {
    if (canvasRef.current && typeof (canvasRef.current as any).measure === 'function') {
      (canvasRef.current as any).measure(
        (_fx: number, _fy: number, _w: number, _h: number, px: number, py: number) => {
          canvasPosRef.current = { x: px, y: py };
        }
      );
    }
  }, []);

  // ── Core: place a pixel at canvas coordinates ────────────────────────────
  const placePixel = useCallback(async (locationX: number, locationY: number) => {
    if (userPixels <= 0) {
      alert('Keine Pixels mehr! Logge deine Stimmung, um mehr zu verdienen.');
      return;
    }

    const x = Math.floor(locationX / pixelSize);
    const y = Math.floor(locationY / pixelSize);
    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return;

    const key = `${x}_${y}`;
    if (pixels[key] === selectedColor) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Optimistic update — localStorage + state
    const newPixels = { ...pixels, [key]: selectedColor };
    setPixels(newPixels);
    saveCanvas(newPixels);

    const newBalance = userPixels - 1;
    setUserPixels(newBalance);
    saveLocalBalance(newBalance);

    // Broadcast to other peers
    channelRef.current?.publish(
      'pixel_update',
      { x, y, color: selectedColor },
      { userId: 'current_user' }
    );

    // Deduct from DB balance (best-effort, no rollback if it fails)
    safeDbUpdateUserPixels('current_user', -1).then(result => {
      if (result !== null) {
        queryClient.invalidateQueries({ queryKey: ['users', 'current_user'] });
      }
    });
  }, [pixelSize, userPixels, selectedColor, pixels, queryClient]);

  // ── Handle press: extract coordinates reliably on both native & web ──────
  const handlePress = useCallback((event: any) => {
    measureCanvas();
    const { locationX: lx, locationY: ly, pageX, pageY } = event.nativeEvent ?? {};

    let locationX = typeof lx === 'number' ? lx : null;
    let locationY = typeof ly === 'number' ? ly : null;

    if ((locationX === null || locationX === undefined) && typeof pageX === 'number') {
      locationX = pageX - canvasPosRef.current.x;
      locationY = pageY - canvasPosRef.current.y;
    }

    if (typeof locationX !== 'number' || typeof locationY !== 'number') return;
    placePixel(locationX, locationY);
  }, [placePixel, measureCanvas]);

  // ── Render SVG pixels ────────────────────────────────────────────────────
  const pixelElements = useMemo(() => {
    return Object.entries(pixels).map(([key, color]) => {
      const [xs, ys] = key.split('_');
      const x = Number(xs);
      const y = Number(ys);
      if (isNaN(x) || isNaN(y)) return null;
      const discoColor = getDiscoColor(x, y);
      return (
        <Rect
          key={key}
          x={x * pixelSize}
          y={y * pixelSize}
          width={pixelSize}
          height={pixelSize}
          fill={discoColor || color}
        />
      );
    }).filter(Boolean);
  }, [pixels, isDiscoEnabled, discoTick, pixelSize, getDiscoColor]);

  return (
    <View style={styles.container}>
      <View style={styles.pixelInfo}>
        <View style={styles.pixelCount}>
          <Ionicons name="color-palette" size={16} color={colors.text} />
          <Text style={styles.pixelText}>{userPixels} {t('pixels_left')}</Text>
        </View>
        <View style={styles.schemeSelector}>
          {(Object.keys(PALETTE_SCHEMES) as (keyof typeof PALETTE_SCHEMES)[]).map((s) => (
            <Pressable
              key={s}
              onPress={() => setScheme(s)}
              style={[styles.schemeDot, scheme === s && styles.schemeDotActive]}
            >
              <View style={[styles.innerDot, { backgroundColor: PALETTE_SCHEMES[s][0] }]} />
            </Pressable>
          ))}
        </View>
      </View>

      <View
        ref={canvasRef}
        onLayout={measureCanvas}
        style={[styles.canvasContainer, { width: totalWidth + 4, height: totalWidth + 4 }]}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <Pressable
            onPress={handlePress}
            style={{ width: totalWidth, height: totalWidth }}
          >
            <Svg
              width={totalWidth}
              height={totalWidth}
              style={Platform.OS === 'web' ? ({ pointerEvents: 'none' } as any) : undefined}
            >
              <Rect width={totalWidth} height={totalWidth} fill="#0a0a0a" />
              {pixelElements}
            </Svg>
          </Pressable>
        )}
      </View>

      <View style={styles.palette}>
        <Text style={styles.infoText}>{t('paint_with_friends')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.paletteScroll}
        >
          {palette.map(color => (
            <Pressable
              key={color}
              onPress={() => setSelectedColor(color)}
              style={[
                styles.colorItem,
                { backgroundColor: color },
                selectedColor === color && styles.selectedColor,
              ]}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.md },
  pixelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pixelCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pixelText: { ...typography.caption, color: colors.text, fontWeight: 'bold' },
  schemeSelector: { flexDirection: 'row', gap: spacing.sm },
  schemeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  schemeDotActive: { borderColor: colors.primary },
  innerDot: { width: 16, height: 16, borderRadius: 8 },
  infoText: { ...typography.tiny, color: colors.textMuted, marginBottom: spacing.xs },
  canvasContainer: {
    backgroundColor: '#000',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  palette: { marginTop: spacing.sm, height: 64 },
  paletteScroll: { gap: spacing.sm, paddingVertical: spacing.xs },
  colorItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectedColor: { borderColor: '#FFF', borderWidth: 3, transform: [{ scale: 1.1 }] },
});
