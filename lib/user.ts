import { Platform } from 'react-native';
import { safeDbList, safeDbCreate, safeDbUpdate } from './api';

const USER_ID_KEY = 'monsaik_user_id';
const USER_NAME_KEY = 'monsaik_display_name';
const ONBOARDED_KEY = 'monsaik_onboarded';

// ─── UUID v4 generator (works without crypto.randomUUID on older browsers) ────
function generateUUID(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function storage() {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage;
  return null;
}

// ─── Get or create a stable user ID for this device ──────────────────────────
export function getUserId(): string {
  const ls = storage();
  if (!ls) return 'current_user'; // native fallback
  let id = ls.getItem(USER_ID_KEY);
  if (!id) {
    id = generateUUID();
    ls.setItem(USER_ID_KEY, id);
  }
  return id;
}

// ─── Display name helpers ─────────────────────────────────────────────────────
export function getLocalDisplayName(): string | null {
  return storage()?.getItem(USER_NAME_KEY) || null;
}

export function setLocalDisplayName(name: string) {
  storage()?.setItem(USER_NAME_KEY, name);
}

export function isOnboarded(): boolean {
  return storage()?.getItem(ONBOARDED_KEY) === '1';
}

export function markOnboarded() {
  storage()?.setItem(ONBOARDED_KEY, '1');
}

// ─── Ensure user exists in Blink DB ──────────────────────────────────────────
export async function ensureUserInDb(userId: string, displayName: string): Promise<void> {
  try {
    const existing = await safeDbList('users', { where: { id: userId }, limit: 1 });
    const shortId = userId.slice(0, 6);
    const username = `@${displayName.toLowerCase().replace(/\s+/g, '_').slice(0, 12)}_${shortId}`;
    const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${userId}`;

    if (existing.length > 0) {
      await safeDbUpdate('users', userId, { displayName, username, avatarUrl });
    } else {
      await safeDbCreate('users', {
        id: userId,
        displayName,
        username,
        avatarUrl,
        pixelBalance: 0,
      });
    }
  } catch (err) {
    console.warn('[MONSAIK] ensureUserInDb failed:', err);
  }
}

// ─── Clear all local data (reset / logout) ───────────────────────────────────
export function clearAllLocalData() {
  const ls = storage();
  if (!ls) return;
  ls.removeItem(USER_ID_KEY);
  ls.removeItem(USER_NAME_KEY);
  ls.removeItem(ONBOARDED_KEY);
  ls.removeItem('monsaik_canvas_v1');
  ls.removeItem('monsaik_balance_v1');
}
