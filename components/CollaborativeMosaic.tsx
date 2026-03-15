import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions, Platform } from 'react-native';
import { Svg, Rect } from 'react-native-svg';
import { colors, spacing, typography, borderRadius } from '@/constants/design';
import { safeDbUpsertPixel, safeDbGetGlobalMosaic, safeDbUpdateUserPixels, safeDbGet } from '@/lib/api';
import { blink } from '@/lib/blink';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { useDiscoStore } from '@/lib/store';

const CANVAS_SIZE = 64;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CANVAS_PADDING = spacing.sm * 2;
const PIXEL_SIZE = (SCREEN_WIDTH - CANVAS_PADDING) / CANVAS_SIZE;
const TOTAL_WIDTH = CANVAS_SIZE * PIXEL_SIZE;

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

export function CollaborativeMosaic() {
  const [pixels, setPixels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [scheme, setScheme] = useState<keyof typeof PALETTE_SCHEMES>('vibrant');
  const palette = PALETTE_SCHEMES[scheme];
  const [selectedColor, setSelectedColor] = useState(palette[0]);
  const [userPixels, setUserPixels] = useState(0);
  const [discoTick, setDiscoTick] = useState(0);
  const channelRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { isDiscoEnabled } = useDiscoStore();

  // Disco animation using simple interval
  useEffect(() => {
    if (!isDiscoEnabled) return;
    const interval = setInterval(() => {
      setDiscoTick(prev => (prev + 1) % DISCO_COLORS.length);
    }, 400);
    return () => clearInterval(interval);
  }, [isDiscoEnabled]);

  const getDiscoColor = useCallback((x: number, y: number) => {
    if (!isDiscoEnabled) return undefined;
    const offset = (x + y) % DISCO_COLORS.length;
    return DISCO_COLORS[(discoTick + offset) % DISCO_COLORS.length];
  }, [isDiscoEnabled, discoTick]);

  // Fetch initial mosaic state and user pixels
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const mosaicRes = await safeDbGetGlobalMosaic();
        const pixelMap: Record<string, string> = {};
        mosaicRes.forEach((p: any) => {
          pixelMap[`${p.x}_${p.y}`] = p.color;
        });
        setPixels(pixelMap);
      } catch (err) {
        console.warn('Failed to load mosaic:', err);
      }

      try {
        const userRes = await safeDbGet('users', 'current_user');
        setUserPixels((userRes as any)?.pixelBalance || 50);
      } catch (err) {
        setUserPixels(50);
      }
      setLoading(false);
    };

    fetchData();

    // Setup Realtime (optional, fails gracefully)
    const initRealtime = async () => {
      try {
        if (!blink || !blink.realtime || typeof blink.realtime.channel !== 'function') return;
        const channel = blink.realtime.channel('global-mosaic');
        channelRef.current = channel;

        await channel.subscribe({ userId: 'current_user' });

        channel.onMessage((msg: any) => {
          if (msg.type === 'pixel_update') {
            const { x, y, color } = msg.data;
            setPixels(prev => ({
              ...prev,
              [`${x}_${y}`]: color
            }));
          }
        });
      } catch (err) {
        console.warn('Realtime mosaic unavailable:', err);
      }
    };

    initRealtime();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setSelectedColor(palette[0]);
  }, [scheme]);

  const handlePress = async (event: any) => {
    if (userPixels <= 0) {
      alert("Keine Pixels mehr! Logge deine Stimmung, um mehr zu verdienen.");
      return;
    }

    const { locationX, locationY } = event.nativeEvent;
    const x = Math.floor(locationX / PIXEL_SIZE);
    const y = Math.floor(locationY / PIXEL_SIZE);

    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return;

    const currentKey = `${x}_${y}`;
    if (pixels[currentKey] === selectedColor) return;

    // Optimistic update
    setPixels(prev => ({ ...prev, [currentKey]: selectedColor }));
    setUserPixels(prev => prev - 1);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    // Persist to DB
    await Promise.all([
      safeDbUpsertPixel(x, y, selectedColor, 'current_user'),
      safeDbUpdateUserPixels('current_user', -1)
    ]);

    queryClient.invalidateQueries({ queryKey: ['users', 'current_user'] });

    // Broadcast to others
    if (channelRef.current) {
      channelRef.current.publish('pixel_update', { x, y, color: selectedColor }, { userId: 'current_user' });
    }
  };

  // Simple SVG pixel rendering (no animated components for SVG to avoid crashes)
  const pixelElements = useMemo(() => {
    return Object.entries(pixels).map(([key, color]) => {
      const [x, y] = key.split('_').map(Number);
      const discoColor = getDiscoColor(x, y);
      return (
        <Rect
          key={key}
          x={x * PIXEL_SIZE}
          y={y * PIXEL_SIZE}
          width={PIXEL_SIZE}
          height={PIXEL_SIZE}
          fill={discoColor || color}
        />
      );
    });
  }, [pixels, isDiscoEnabled, discoTick]);

  return (
    <View style={styles.container}>
      <View style={styles.pixelInfo}>
        <View style={styles.pixelCount}>
          <Ionicons name="color-palette" size={18} color={colors.text} />
          <Text style={styles.pixelText}>{userPixels} {t('pixels_left')}</Text>
        </View>
        <View style={styles.schemeSelector}>
          {Object.keys(PALETTE_SCHEMES).map((s) => (
            <Pressable
              key={s}
              onPress={() => setScheme(s as any)}
              style={[styles.schemeDot, scheme === s && styles.schemeDotActive]}
            >
              <View style={[styles.innerDot, { backgroundColor: PALETTE_SCHEMES[s as keyof typeof PALETTE_SCHEMES][0] }]} />
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.canvasContainer}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <View style={styles.canvasWrapper}>
            <Pressable onPress={handlePress}>
              <Svg width={TOTAL_WIDTH} height={TOTAL_WIDTH}>
                <Rect width={TOTAL_WIDTH} height={TOTAL_WIDTH} fill="#0a0a0a" />
                {pixelElements}
              </Svg>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.palette}>
        <Text style={styles.infoText}>{t('paint_with_friends')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteScroll}>
          {palette.map(color => (
            <Pressable
              key={color}
              onPress={() => setSelectedColor(color)}
              style={[
                styles.colorItem,
                { backgroundColor: color },
                selectedColor === color && styles.selectedColor
              ]}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  pixelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
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
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pixelText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: 'bold',
  },
  schemeSelector: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  schemeDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  schemeDotActive: {
    borderColor: colors.primary,
  },
  innerDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  infoText: {
    ...typography.tiny,
    color: colors.textMuted,
  },
  canvasContainer: {
    width: TOTAL_WIDTH + 4,
    height: TOTAL_WIDTH + 4,
    backgroundColor: '#000',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  canvasWrapper: {
    width: TOTAL_WIDTH,
    height: TOTAL_WIDTH,
  },
  palette: {
    marginTop: spacing.md,
    height: 60,
  },
  paletteScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  colorItem: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  selectedColor: {
    borderColor: '#FFF',
    borderWidth: 3,
    transform: [{ scale: 1.1 }],
  },
});
