/**
 * Cross-platform storage:
 *  - Web  → localStorage (synchronous, always available)
 *  - Native → AsyncStorage with an in-memory sync cache (hydrated at boot)
 *
 * AsyncStorage is required() dynamically so it NEVER gets included in the
 * web Metro bundle, which avoids the native-module bridge crash on iOS Safari.
 */
import { Platform } from 'react-native';

// ─── In-memory cache for sync reads on native ────────────────────────────────
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

function getWebStorage(): Storage | null {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage;
  } catch {}
  return null;
}

/** Call once at app startup (native only — web is synchronous already). */
export async function hydrateStorage(): Promise<void> {
  if (Platform.OS === 'web') return; // nothing to hydrate on web
  try {
    // Dynamic require keeps AsyncStorage OUT of the web bundle entirely
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const pairs: [string, string | null][] = await AsyncStorage.multiGet(KEYS);
    for (const [key, value] of pairs) {
      if (value !== null) cache[key] = value;
    }
  } catch (e) {
    console.warn('[storage] hydrateStorage failed:', e);
  }
}

/** Synchronous read. On web uses localStorage; on native reads from cache. */
export function storageGetItem(key: string): string | null {
  if (Platform.OS === 'web') {
    return getWebStorage()?.getItem(key) ?? null;
  }
  return cache[key] ?? null;
}

/** Synchronous write. On web uses localStorage; on native updates cache + async persist. */
export function storageSetItem(key: string, value: string): void {
  if (Platform.OS === 'web') {
    getWebStorage()?.setItem(key, value);
    return;
  }
  cache[key] = value;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.setItem(key, value).catch(() => {});
  } catch {}
}

/** Synchronous remove. On web uses localStorage; on native updates cache + async persist. */
export function storageRemoveItem(key: string): void {
  if (Platform.OS === 'web') {
    getWebStorage()?.removeItem(key);
    return;
  }
  delete cache[key];
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.removeItem(key).catch(() => {});
  } catch {}
}
