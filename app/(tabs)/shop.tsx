import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Alert, Modal, ListRenderItem } from 'react-native';
import { Container } from '@/components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/design';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeDbList, safeDbUpdate } from '@/lib/api';
import { getUserId } from '@/lib/user';
import { SHOP_ITEMS, ShopItem, getOwnedItems, isItemOwned, addOwnedItem, getActiveFrame, setActiveFrame } from '@/lib/shop';

type CategoryFilter = 'all' | 'avatar_frame' | 'palette' | 'badge';

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'Alle',
  avatar_frame: 'Rahmen',
  palette: 'Paletten',
  badge: 'Abzeichen',
};

const CATEGORY_ICONS: Record<CategoryFilter, string> = {
  all: 'grid',
  avatar_frame: 'person-circle',
  palette: 'color-palette',
  badge: 'ribbon',
};

function PreviewSwatch({ item }: { item: ShopItem }) {
  if (item.previewType === 'icon') {
    return (
      <View style={[swatchStyles.base, { backgroundColor: colors.surface }]}>
        <Ionicons name={item.preview as any} size={28} color={colors.accent} />
      </View>
    );
  }
  if (item.previewType === 'gradient') {
    return (
      <View style={[swatchStyles.base, { overflow: 'hidden' }]}>
        <View style={[swatchStyles.half, { backgroundColor: item.preview }]} />
        <View style={[swatchStyles.half, { backgroundColor: item.previewExtra || item.preview }]} />
      </View>
    );
  }
  return <View style={[swatchStyles.base, { backgroundColor: item.preview }]} />;
}

const swatchStyles = StyleSheet.create({
  base: { width: 56, height: 56, borderRadius: borderRadius.lg, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  half: { flex: 1, width: '100%' },
});

function ShopItemCard({ item, pixels, onBuy }: {
  item: ShopItem;
  pixels: number;
  onBuy: (item: ShopItem) => void;
}) {
  const owned = isItemOwned(item.id);
  const canAfford = pixels >= item.price;
  const isActiveFrame = item.category === 'avatar_frame' && getActiveFrame() === item.id;

  return (
    <Animated.View entering={FadeInDown.duration(400)} style={cardStyles.card}>
      <PreviewSwatch item={item} />
      <View style={cardStyles.info}>
        <Text style={cardStyles.name}>{item.name}</Text>
        <Text style={cardStyles.desc}>{item.description}</Text>
      </View>
      {owned ? (
        <View style={cardStyles.ownedBadge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.secondary} />
          <Text style={cardStyles.ownedText}>{isActiveFrame ? 'Aktiv' : 'Besitzt'}</Text>
        </View>
      ) : (
        <Pressable
          style={[cardStyles.buyBtn, !canAfford && cardStyles.buyBtnDisabled]}
          onPress={() => onBuy(item)}
          disabled={!canAfford}
        >
          <Ionicons name="diamond" size={12} color={canAfford ? '#FFF' : colors.textMuted} />
          <Text style={[cardStyles.buyPrice, !canAfford && cardStyles.buyPriceDisabled]}>
            {item.price}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: borderRadius.xl,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  info: { flex: 1 },
  name: { ...typography.captionBold, color: colors.text, marginBottom: 2 },
  desc: { ...typography.tiny, color: colors.textMuted },
  ownedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ownedText: { ...typography.small, color: colors.secondary, fontWeight: '600' },
  buyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: 8, paddingHorizontal: spacing.sm,
  },
  buyBtnDisabled: { backgroundColor: colors.surface },
  buyPrice: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  buyPriceDisabled: { color: colors.textMuted },
});

export default function ShopScreen() {
  const userId = getUserId();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [ownedState, setOwnedState] = useState<string[]>(() => getOwnedItems());

  const { data: userData, isLoading } = useQuery({
    queryKey: ['users', userId],
    queryFn: async () => {
      const results = await safeDbList('users', { where: { id: userId }, limit: 1 });
      return results[0] || null;
    },
  });

  const pixels: number = userData?.pixelBalance ?? 0;

  const filtered = useMemo(() =>
    filter === 'all' ? SHOP_ITEMS : SHOP_ITEMS.filter(i => i.category === filter),
    [filter]
  );

  const handleBuy = (item: ShopItem) => {
    if (pixels < item.price) {
      Alert.alert('Nicht genug Pixels', `Du brauchst ${item.price} Pixels, hast aber nur ${pixels}.`);
      return;
    }

    Alert.alert(
      item.name + ' kaufen?',
      `${item.price} Pixels für "${item.name}" ausgeben?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Kaufen',
          onPress: async () => {
            const newBalance = pixels - item.price;
            await safeDbUpdate('users', userId, { pixelBalance: newBalance });
            addOwnedItem(item.id);
            if (item.category === 'avatar_frame') setActiveFrame(item.id);
            setOwnedState(getOwnedItems());
            queryClient.invalidateQueries({ queryKey: ['users', userId] });
            Alert.alert('Gekauft!', `${item.name} ist jetzt deins.`);
          },
        },
      ]
    );
  };

  return (
    <Container safeArea edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Shop</Text>
          <Text style={styles.subtitle}>Gib deine Pixels aus</Text>
        </View>
        <View style={styles.pixelBadge}>
          <Ionicons name="diamond" size={16} color={colors.accent} />
          {isLoading
            ? <ActivityIndicator size="small" color={colors.accent} />
            : <Text style={styles.pixelCount}>{pixels}</Text>}
        </View>
      </View>

      {/* Category filter */}
      <View style={styles.filterRow}>
        {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map(cat => (
          <Pressable
            key={cat}
            style={[styles.filterChip, filter === cat && styles.filterChipActive]}
            onPress={() => setFilter(cat)}
          >
            <Ionicons
              name={CATEGORY_ICONS[cat] as any}
              size={14}
              color={filter === cat ? '#FFF' : colors.textMuted}
            />
            <Text style={[styles.filterChipText, filter === cat && styles.filterChipTextActive]}>
              {CATEGORY_LABELS[cat]}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        key={filter}
        data={filtered}
        keyExtractor={i => i.id}
        renderItem={({ item }) => (
          <ShopItemCard item={item} pixels={pixels} onBuy={handleBuy} />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted },
  pixelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${colors.accent}18`, borderRadius: borderRadius.full,
    paddingVertical: 8, paddingHorizontal: spacing.md,
    borderWidth: 1, borderColor: `${colors.accent}30`,
  },
  pixelCount: { ...typography.captionBold, color: colors.accent },
  filterRow: {
    flexDirection: 'row', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surface, borderRadius: borderRadius.full,
    paddingVertical: 6, paddingHorizontal: spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { ...typography.tiny, color: colors.textMuted, fontWeight: '600' },
  filterChipTextActive: { color: '#FFF' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
});
