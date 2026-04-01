/**
 * Web storage implementation — localStorage only.
 * Metro resolves this file for web bundles; AsyncStorage never gets included.
 */

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export async function hydrateStorage(): Promise<void> {
  // Nothing to hydrate on web — localStorage is synchronous
}

export function storageGetItem(key: string): string | null {
  return ls()?.getItem(key) ?? null;
}

export function storageSetItem(key: string, value: string): void {
  try {
    ls()?.setItem(key, value);
  } catch {}
}

export function storageRemoveItem(key: string): void {
  try {
    ls()?.removeItem(key);
  } catch {}
}
