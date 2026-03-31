// ─── Shop item definitions ────────────────────────────────────────────────────

export type ShopItemCategory = 'avatar_frame' | 'palette' | 'badge';

export interface ShopItem {
  id: string;
  category: ShopItemCategory;
  name: string;
  description: string;
  price: number;
  preview: string;    // color or icon name
  previewType: 'color' | 'icon' | 'gradient';
  previewExtra?: string;  // second color for gradient
}

export const SHOP_ITEMS: ShopItem[] = [
  // ── Avatar frames ──────────────────────────────────────────────────────────
  {
    id: 'frame_gold',
    category: 'avatar_frame',
    name: 'Gold-Rahmen',
    description: 'Für echte Pixel-Legenden',
    price: 50,
    preview: '#FFD700',
    previewType: 'color',
  },
  {
    id: 'frame_aurora',
    category: 'avatar_frame',
    name: 'Aurora-Rahmen',
    description: 'Schimmerndes Nordlicht',
    price: 80,
    preview: '#00CED1',
    previewType: 'gradient',
    previewExtra: '#8A2BE2',
  },
  {
    id: 'frame_fire',
    category: 'avatar_frame',
    name: 'Feuer-Rahmen',
    description: 'Brennend heiß',
    price: 60,
    preview: '#FF4500',
    previewType: 'gradient',
    previewExtra: '#FFD700',
  },
  {
    id: 'frame_neon',
    category: 'avatar_frame',
    name: 'Neon-Rahmen',
    description: 'Leuchtet in der Dunkelheit',
    price: 70,
    preview: '#39FF14',
    previewType: 'color',
  },

  // ── Extra palettes ─────────────────────────────────────────────────────────
  {
    id: 'palette_sunset',
    category: 'palette',
    name: 'Sonnenuntergang',
    description: '18 warme Abendfarben',
    price: 40,
    preview: '#FF6B35',
    previewType: 'gradient',
    previewExtra: '#F7C59F',
  },
  {
    id: 'palette_ocean',
    category: 'palette',
    name: 'Ozean',
    description: '18 tiefblaue Meeresfarben',
    price: 40,
    preview: '#006994',
    previewType: 'gradient',
    previewExtra: '#40E0D0',
  },
  {
    id: 'palette_forest',
    category: 'palette',
    name: 'Wald',
    description: '18 satte Grüntöne',
    price: 40,
    preview: '#228B22',
    previewType: 'gradient',
    previewExtra: '#ADFF2F',
  },
  {
    id: 'palette_candy',
    category: 'palette',
    name: 'Candyland',
    description: '18 süße Pastellfarben',
    price: 30,
    preview: '#FF69B4',
    previewType: 'gradient',
    previewExtra: '#FFB6C1',
  },

  // ── Badges ─────────────────────────────────────────────────────────────────
  {
    id: 'badge_streak7',
    category: 'badge',
    name: 'Sieben-Tage-Badge',
    description: '7-Tage-Streak-Abzeichen',
    price: 20,
    preview: 'flame',
    previewType: 'icon',
  },
  {
    id: 'badge_artist',
    category: 'badge',
    name: 'Künstler-Abzeichen',
    description: 'Für 100+ Mosaikpixel',
    price: 30,
    preview: 'brush',
    previewType: 'icon',
  },
  {
    id: 'badge_gamer',
    category: 'badge',
    name: 'Spieler-Abzeichen',
    description: 'Für 5 gewonnene Spiele',
    price: 25,
    preview: 'game-controller',
    previewType: 'icon',
  },
];

// ─── Local purchase store ──────────────────────────────────────────────────────
import { Platform } from 'react-native';

const OWNED_KEY = 'monsaik_owned_items_v1';

function storage() {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function getOwnedItems(): string[] {
  try {
    const raw = storage()?.getItem(OWNED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function isItemOwned(itemId: string): boolean {
  return getOwnedItems().includes(itemId);
}

export function addOwnedItem(itemId: string): void {
  const current = getOwnedItems();
  if (!current.includes(itemId)) {
    storage()?.setItem(OWNED_KEY, JSON.stringify([...current, itemId]));
  }
}

export function getActiveFrame(): string | null {
  return storage()?.getItem('monsaik_active_frame') || null;
}

export function setActiveFrame(frameId: string | null): void {
  if (frameId) {
    storage()?.setItem('monsaik_active_frame', frameId);
  } else {
    storage()?.removeItem('monsaik_active_frame');
  }
}
