/**
 * Native storage implementation — AsyncStorage with a sync in-memory cache.
 * Metro resolves this file for iOS/Android bundles only.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const cache: Record<string, string> = {};

const KEYS = [
  'monsaik_user_id',
  'monsaik_display_name',
  'monsaik_onboarded',
  'monsaik_friends_v1',
  'monsaik_owned_items_v1',
  'monsaik_active_frame',
  'monsaik_canvas_v1',
  'monsaik_balance_v1',
];

export async function hydrateStorage(): Promise<void> {
  try {
    const pairs = await AsyncStorage.multiGet(KEYS);
    for (const [key, value] of pairs) {
      if (value !== null) cache[key] = value;
    }
  } catch (e) {
    console.warn('[storage] hydrateStorage failed:', e);
  }
}

export function storageGetItem(key: string): string | null {
  return cache[key] ?? null;
}

export function storageSetItem(key: string, value: string): void {
  cache[key] = value;
  AsyncStorage.setItem(key, value).catch(() => {});
}

export function storageRemoveItem(key: string): void {
  delete cache[key];
  AsyncStorage.removeItem(key).catch(() => {});
}
