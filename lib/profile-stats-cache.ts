const PROFILE_STATS_CACHE_TTL_MS = 20_000;

type CacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const profileStatsCache = new Map<string, CacheEntry>();
const profileStatsInflight = new Map<string, Promise<unknown>>();

export function getProfileStatsCache<T>(userId: string): T | null {
  const cached = profileStatsCache.get(userId);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    profileStatsCache.delete(userId);
    return null;
  }

  return cached.payload as T;
}

export function setProfileStatsCache<T>(userId: string, payload: T): void {
  profileStatsCache.set(userId, {
    payload,
    expiresAt: Date.now() + PROFILE_STATS_CACHE_TTL_MS,
  });
}

export function invalidateProfileStatsCache(userId?: string): void {
  if (!userId) {
    profileStatsCache.clear();
    profileStatsInflight.clear();
    return;
  }

  profileStatsCache.delete(userId);
  profileStatsInflight.delete(userId);
}

export function getProfileStatsInflight<T>(userId: string): Promise<T> | null {
  const inflight = profileStatsInflight.get(userId);
  return inflight ? (inflight as Promise<T>) : null;
}

export function setProfileStatsInflight<T>(userId: string, promise: Promise<T>): Promise<T> {
  profileStatsInflight.set(userId, promise as Promise<unknown>);
  return promise.finally(() => {
    if (profileStatsInflight.get(userId) === promise) {
      profileStatsInflight.delete(userId);
    }
  });
}
