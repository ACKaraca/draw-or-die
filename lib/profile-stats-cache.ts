const PROFILE_STATS_CACHE_TTL_MS = 20_000;

type CacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const profileStatsCache = new Map<string, CacheEntry>();

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
  if (userId) {
    profileStatsCache.delete(userId);
    return;
  }

  profileStatsCache.clear();
}
