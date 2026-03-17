import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { Svg, Rect } from 'react-native-svg';
import { colors, spacing, typography, borderRadius } from '@/constants/design';
import { safeDbUpsertPixel, safeDbGetGlobalMosaic, safeDbUpdateUserPixels, safeDbGet, safeDbDeletePixel } from '@/lib/api';
import { blink } from '@/lib/blink';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/lib/i18n';
import { useDiscoStore } from '@/lib/store';

const CANVAS_SIZE = 64;

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
  const { width: screenWidth } = useWindowDimensions();
  const canvasPadding = spacing.md * 2;
  const pixelSize = Math.max(1, (screenWidth - canvasPadding) / CANVAS_SIZE);
  const totalWidth = CANVAS_SIZE * pixelSize;

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const mosaicRes = await safeDbGetGlobalMosaic();
        const pixelMap: Record<string, string> = {};
        mosaicRes.forEach((p: any) => {
          if (typeof p.x === 'number' && typeof p.y === 'number') {
            pixelMap[`${p.x}_${p.y}`] = p.color;
          }
        });
        setPixels(pixelMap);
      } catch (err) {
        console.warn('Failed to load mosaic:', err);
      }

      try {
        const userRes = await safeDbGet('users', 'current_user');
        setUserPixels((userRes as any)?.pixelBalance || 50);
      } catch {
        setUserPixels(50);
      }
      setLoading(false);
    };

    fetchData();

    const initRealtime = async () => {
      try {
        if (!blink || !blink.realtime || typeof blink.realtime.channel !== 'function') return;
        const channel = blink.realtime.channel('global-mosaic');
        channelRef.current = channel;
        await channel.subscribe({ userId: 'current_user' });
        channel.onMessage((msg: any) => {
          if (msg.type === 'pixel_update') {
            const { x, y, color } = msg.data;
            if (typeof x === 'number' && typeof y === 'number') {
              setPixels(prev => ({ ...prev, [`${x}_${y}`]: color }));
            }
          }
        });
      } catch (err) {
        console.warn('Realtime mosaic unavailable:', err);
      }
    };

    initRealtime();
    return () => { channelRef.current?.unsubscribe(); };
  }, []);

  useEffect(() => {
    setSelectedColor(palette[0]);
  }, [scheme]);

  const handlePress = useCallback(async (event: any) => {
    if (userPixels <= 0) {
      alert("Keine Pixels mehr! Logge deine Stimmung, um mehr zu verdienen.");
      return;
    }

    const { locationX, locationY } = event.nativeEvent;
    if (typeof locationX !== 'number' || typeof locationY !== 'number') return;

    const x = Math.floor(locationX / pixelSize);
    const y = Math.floor(locationY / pixelSize);

    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return;

    const currentKey = `${x}_${y}`;
    if (pixels[currentKey] === selectedColor) return;

    const previousColor = pixels[currentKey];
    setPixels(prev => ({ ...prev, [currentKey]: selectedColor }));
    setUserPixels(prev => prev - 1);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    try {
      const pixelResult = await safeDbUpsertPixel(x, y, selectedColor, 'current_user');
      if (pixelResult === null || pixelResult === undefined) {
        throw new Error('Pixel upsert returned null');
      }

      const balanceResult = await safeDbUpdateUserPixels('current_user', -1);
      if (balanceResult === null || balanceResult === undefined) {
        if (previousColor) {
          await safeDbUpsertPixel(x, y, previousColor, 'current_user');
        } else {
          await safeDbDeletePixel(x, y);
        }
        throw new Error('Balance update returned null');
      }

      queryClient.invalidateQueries({ queryKey: ['users', 'current_user'] });

      if (channelRef.current) {
        channelRef.current.publish('pixel_update', { x, y, color: selectedColor }, { userId: 'current_user' });
      }
    } catch (err) {
      setPixels(prev => {
        const next = { ...prev };
        if (previousColor) {
          next[currentKey] = previousColor;
        } else {
          delete next[currentKey];
        }
        return next;
      });
      setUserPixels(prev => prev + 1);
      console.warn('[MONSAIK] Pixel placement failed, rolled back:', err);
    }
  }, [pixelSize, userPixels, selectedColor, pixels, queryClient]);

  const pixelElements = useMemo(() => {
    return Object.entries(pixels).map(([key, color]) => {
      const parts = key.split('_');
      const x = Number(parts[0]);
      const y = Number(parts[1]);
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

      <View style={[styles.canvasContainer, { width: totalWidth + 4, height: totalWidth + 4 }]}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <View style={{ width: totalWidth, height: totalWidth }}>
            <Pressable onPress={handlePress}>
              <Svg width={totalWidth} height={totalWidth}>
                <Rect width={totalWidth} height={totalWidth} fill="#0a0a0a" />
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
    marginBottom: spacing.xs,
  },
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
  palette: {
    marginTop: spacing.sm,
    height: 64,
  },
  paletteScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
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
