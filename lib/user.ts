import { safeDbList, safeDbCreate, safeDbUpdate } from './api';
import { storageGetItem, storageSetItem, storageRemoveItem } from './storage';

const USER_ID_KEY = 'monsaik_user_id';
const USER_NAME_KEY = 'monsaik_display_name';
const ONBOARDED_KEY = 'monsaik_onboarded';

// ─── UUID v4 generator ────────────────────────────────────────────────────────
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

// ─── Get or create a stable user ID for this device ──────────────────────────
export function getUserId(): string {
  let id = storageGetItem(USER_ID_KEY);
  if (!id) {
    id = generateUUID();
    storageSetItem(USER_ID_KEY, id);
  }
  return id;
}

// ─── Display name helpers ─────────────────────────────────────────────────────
export function getLocalDisplayName(): string | null {
  return storageGetItem(USER_NAME_KEY);
}

export function setLocalDisplayName(name: string) {
  storageSetItem(USER_NAME_KEY, name);
}

export function isOnboarded(): boolean {
  return storageGetItem(ONBOARDED_KEY) === '1';
}

export function markOnboarded() {
  storageSetItem(ONBOARDED_KEY, '1');
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
  storageRemoveItem(USER_ID_KEY);
  storageRemoveItem(USER_NAME_KEY);
  storageRemoveItem(ONBOARDED_KEY);
  storageRemoveItem('monsaik_canvas_v1');
  storageRemoveItem('monsaik_balance_v1');
  storageRemoveItem('monsaik_friends_v1');
  storageRemoveItem('monsaik_owned_items_v1');
  storageRemoveItem('monsaik_active_frame');
}
