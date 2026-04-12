import { getFeatureFlag } from '@/lib/appwrite/server';

/** Feature flag key in `feature_flags` — set `enabled` false in Appwrite to end the promo. */
export const MULTI_JURY_PROMO_FLAG_KEY = 'multi_jury_promo';

/**
 * When no row exists yet, treat promo as on so new installs work before bootstrap runs.
 * After bootstrap, the row is created and can be toggled in the database.
 */
export async function isMultiJuryPromoEnabled(): Promise<boolean> {
  try {
    const row = await getFeatureFlag(MULTI_JURY_PROMO_FLAG_KEY);
    if (!row) return true;
    return Boolean(row.enabled);
  } catch {
    return true;
  }
}
