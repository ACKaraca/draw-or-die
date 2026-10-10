import { getFeatureFlag } from '@/lib/appwrite/server';

/** Feature flag key in `feature_flags` — set `enabled` false in Appwrite to end the promo. */
export const MULTI_JURY_PROMO_FLAG_KEY = 'multi_jury_promo';

// Read on every page load (feature-flags route) and every MULTI_JURY call; a toggle in
// Appwrite therefore takes up to this long to reach each server instance.
const PROMO_FLAG_CACHE_TTL_MS = 60 * 1000;

let cachedPromoFlag: { isEnabled: boolean; expiresAt: number } | null = null;

/**
 * When no row exists yet, treat promo as on so new installs work before bootstrap runs.
 * After bootstrap, the row is created and can be toggled in the database.
 */
export async function isMultiJuryPromoEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cachedPromoFlag && cachedPromoFlag.expiresAt > now) {
    return cachedPromoFlag.isEnabled;
  }

  let isEnabled: boolean;
  try {
    const row = await getFeatureFlag(MULTI_JURY_PROMO_FLAG_KEY);
    isEnabled = row ? Boolean(row.enabled) : true;
  } catch {
    isEnabled = true;
  }

  cachedPromoFlag = { isEnabled, expiresAt: now + PROMO_FLAG_CACHE_TTL_MS };
  return isEnabled;
}
