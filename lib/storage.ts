/**
 * Cross-platform storage: localStorage on web, AsyncStorage on native.
 * Synchronous reads from an in-memory cache (populated at boot).
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── In-memory cache for sync reads on native ────────────────────────────────
const cache: Record<string, string> = {};
let hydrated = false;

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

/** Call once at app startup (before reading any stored values). */
export async function hydrateStorage(): Promise<void> {
  if (Platform.OS === 'web') {
    hydrated = true;
    return;
  }
  try {
    const pairs = await AsyncStorage.multiGet(KEYS);
    for (const [key, value] of pairs) {
      if (value !== null) cache[key] = value;
    }
  } catch {}
  hydrated = true;
}

function webStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

/** Synchronous read — works on both web and native (after hydration). */
export function storageGetItem(key: string): string | null {
  if (Platform.OS === 'web') {
    return webStorage()?.getItem(key) ?? null;
  }
  return cache[key] ?? null;
}

/** Synchronous write — instant on web, async on native (fire-and-forget). */
export function storageSetItem(key: string, value: string): void {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(key, value);
    return;
  }
  cache[key] = value;
  AsyncStorage.setItem(key, value).catch(() => {});
}

/** Synchronous remove — instant on web, async on native (fire-and-forget). */
export function storageRemoveItem(key: string): void {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(key);
    return;
  }
  delete cache[key];
  AsyncStorage.removeItem(key).catch(() => {});
}
