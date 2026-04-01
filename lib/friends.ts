import { safeDbList } from './api';
import { storageGetItem, storageSetItem } from './storage';

const FRIENDS_KEY = 'monsaik_friends_v1';

// ─── Local friend list (list of user IDs) ─────────────────────────────────────
export function getLocalFriends(): string[] {
  try {
    const raw = storageGetItem(FRIENDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addLocalFriend(userId: string): string[] {
  const current = getLocalFriends();
  if (current.includes(userId)) return current;
  const updated = [...current, userId];
  storageSetItem(FRIENDS_KEY, JSON.stringify(updated));
  return updated;
}

export function removeLocalFriend(userId: string): string[] {
  const updated = getLocalFriends().filter(id => id !== userId);
  storageSetItem(FRIENDS_KEY, JSON.stringify(updated));
  return updated;
}

export function isFriend(userId: string): boolean {
  return getLocalFriends().includes(userId);
}

// ─── Invite code: the user's ID short-form that they share ───────────────────
export function makeInviteCode(userId: string): string {
  return userId.replace(/-/g, '').slice(0, 12).toUpperCase();
}

// ─── Resolve an invite code to a DB user ─────────────────────────────────────
export async function resolveInviteCode(code: string): Promise<{ id: string; displayName: string; avatarUrl: string } | null> {
  try {
    const normalized = code.replace(/[\s-]/g, '').toUpperCase().slice(0, 12);
    const allUsers = await safeDbList('users', { limit: 500 });
    const match = allUsers.find((u: any) => {
      const userCode = (u.id || '').replace(/-/g, '').slice(0, 12).toUpperCase();
      return userCode === normalized;
    });
    if (!match) return null;
    return {
      id: (match as any).id,
      displayName: (match as any).displayName || 'Unbekannt',
      avatarUrl: (match as any).avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${(match as any).id}`,
    };
  } catch {
    return null;
  }
}
