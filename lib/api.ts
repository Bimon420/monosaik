import { blink } from './blink';

/**
 * Safe DB query wrapper that catches SDK response parsing errors
 * (e.g. when tunnel returns undefined responses or network issues)
 */
export async function safeDbList<T = any>(
  table: string,
  options?: Record<string, any>
): Promise<T[]> {
  try {
    const db = blink?.db as any;
    if (!db) {
      console.warn(`[MONSAIK] DB not available`);
      return [];
    }
    const tableRef = db[table];
    if (!tableRef || typeof tableRef.list !== 'function') {
      console.warn(`[MONSAIK] DB table "${table}" not available`);
      return [];
    }
    const result = await tableRef.list(options || {});
    if (!result || !Array.isArray(result)) {
      return [];
    }
    return result;
  } catch (err: any) {
    // Catch any SDK internal parsing errors (e.g. reading .body of undefined)
    console.warn(`[MONSAIK] DB list "${table}" failed:`, err?.message || err);
    return [];
  }
}

export async function safeDbCreate<T = any>(
  table: string,
  data: Record<string, any>
): Promise<T | null> {
  try {
    const db = blink?.db as any;
    if (!db) return null;
    const tableRef = db[table];
    if (!tableRef || typeof tableRef.create !== 'function') {
      console.warn(`[MONSAIK] DB table "${table}" not available`);
      return null;
    }
    const result = await tableRef.create(data);
    return result || null;
  } catch (err: any) {
    console.warn(`[MONSAIK] DB create "${table}" failed:`, err?.message || err);
    return null;
  }
}

export async function safeDbUpdate<T = any>(
  table: string,
  id: string,
  data: Record<string, any>
): Promise<T | null> {
  try {
    const db = blink?.db as any;
    if (!db) return null;
    const tableRef = db[table];
    if (!tableRef || typeof tableRef.update !== 'function') {
      console.warn(`[MONSAIK] DB table "${table}" not available`);
      return null;
    }
    const result = await tableRef.update(id, data);
    return result || null;
  } catch (err: any) {
    console.warn(`[MONSAIK] DB update "${table}" failed:`, err?.message || err);
    return null;
  }
}

export async function safeDbGet<T = any>(
  table: string,
  id: string
): Promise<T | null> {
  try {
    const db = blink?.db as any;
    if (!db || !db[table]) {
      console.warn(`[MONSAIK] DB table "${table}" not available`);
      return null;
    }
    const result = await db[table].get(id);
    return result || null;
  } catch (err: any) {
    console.warn(`[MONSAIK] DB get "${table}" failed:`, err?.message || err);
    return null;
  }
}

export async function safeDbCount(
  table: string,
  options?: Record<string, any>
): Promise<number> {
  try {
    const db = blink?.db as any;
    if (!db || !db[table]) {
      console.warn(`[MONSAIK] DB table "${table}" not available`);
      return 0;
    }
    // Try count method first, fall back to list length
    if (typeof db[table].count === 'function') {
      const result = await db[table].count(options || {});
      return typeof result === 'number' ? result : 0;
    }
    // Fallback: list and count
    const results = await db[table].list(options || {});
    return Array.isArray(results) ? results.length : 0;
  } catch (err: any) {
    console.warn(`[MONSAIK] DB count "${table}" failed:`, err?.message || err);
    return 0;
  }
}

export async function safeDbUpdateUserPixels(userId: string, amount: number) {
  try {
    const db = blink?.db as any;
    if (!db || !db.users) return null;
    
    let user;
    try {
      user = await db.users.get(userId);
    } catch {
      return null;
    }
    if (!user) return null;
    
    const newBalance = (user.pixelBalance || 0) + amount;
    if (newBalance < 0) return null; // Cannot have negative balance
    return await db.users.update(userId, { pixelBalance: newBalance });
  } catch (err: any) {
    console.warn(`[MONSAIK] Failed to update user pixels:`, err?.message || err);
    return null;
  }
}

export async function safeDbUpsertPixel(x: number, y: number, color: string, userId: string) {
  try {
    const db = blink?.db as any;
    if (!db) return null;
    const table = db.globalMosaic || db.global_mosaic;
    if (!table) return null;

    const id = `${x}_${y}`;
    const now = new Date().toISOString();

    // Prefer native upsert if available
    if (typeof table.upsert === 'function') {
      try {
        const r = await table.upsert({ id, x, y, color, userId, updatedAt: now });
        if (r !== null && r !== undefined) return r;
      } catch {}
    }

    // Fall back: get → update, or create
    let existing: any = null;
    if (typeof table.get === 'function') {
      try { existing = await table.get(id); } catch {}
    }

    if (existing && typeof table.update === 'function') {
      return await table.update(id, { color, userId, updatedAt: now });
    }

    if (typeof table.create === 'function') {
      try {
        return await table.create({ id, x, y, color, userId, updatedAt: now });
      } catch {
        // Duplicate (race) — try update
        if (typeof table.update === 'function') {
          try { return await table.update(id, { color, userId, updatedAt: now }); } catch {}
        }
      }
    }

    return null;
  } catch (err: any) {
    console.warn(`[MONSAIK] Pixel upsert failed:`, err?.message || err);
    return null;
  }
}

export async function safeDbDeletePixel(x: number, y: number) {
  try {
    const db = blink?.db as any;
    if (!db) return null;
    const table = db.globalMosaic || db.global_mosaic;
    if (!table) return null;
    const id = `${x}_${y}`;
    if (typeof table.delete === 'function') {
      return await table.delete(id);
    }
    return null;
  } catch (err: any) {
    console.warn(`[MONSAIK] Pixel delete failed:`, err?.message || err);
    return null;
  }
}

export async function safeDbGetGlobalMosaic() {
  try {
    const db = blink?.db as any;
    if (!db) return [];
    // Try camelCase first (SDK convention), then snake_case
    const table = db.globalMosaic || db.global_mosaic;
    if (!table || typeof table.list !== 'function') return [];
    
    const result = await table.list({ limit: 5000 });
    if (!result || !Array.isArray(result)) return [];
    return result;
  } catch (err: any) {
    console.warn(`[MONSAIK] Failed to get global mosaic:`, err?.message || err);
    return [];
  }
}