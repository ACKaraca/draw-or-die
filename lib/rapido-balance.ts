import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PROFILES_ID,
  getAdminTables,
  getProfileRowForUser,
  updateProfileById,
  updateProfileRowById,
  type NormalizedUserProfile,
  type UserProfileRow,
} from '@/lib/appwrite/server';
import { logServerError } from '@/lib/logger';
import {
  RAPIDO_PRECISION_SCALE,
  splitRapidoCents,
  toRapidoCents,
} from '@/lib/rapido-cents';

/**
 * Deducts `costCents` from a user's Rapido balance and returns the balance left (in cents).
 *
 * Whole-Rapido costs use Appwrite's atomic decrement, so a Stripe/promo credit that lands
 * while an AI call is running is never overwritten by a stale "balance - cost" write.
 * Fractional costs (and any atomic failure, e.g. the balance dropped below the cost because
 * of a parallel request) fall back to a fresh read-then-write clamped at zero.
 */
export async function deductRapidoCents(params: {
  userId: string;
  profileRowId?: string;
  costCents: number;
  knownBalanceCents: number;
}): Promise<number> {
  const costCents = Math.max(0, Math.round(params.costCents));
  if (costCents === 0) return params.knownBalanceCents;

  if (params.profileRowId && costCents % RAPIDO_PRECISION_SCALE === 0) {
    try {
      const row = await getAdminTables().decrementRowColumn<UserProfileRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_PROFILES_ID,
        rowId: params.profileRowId,
        column: 'rapido_pens',
        value: costCents / RAPIDO_PRECISION_SCALE,
        min: 0,
      });
      const pens = Number(row.rapido_pens);
      if (Number.isFinite(pens) && pens >= 0) {
        return toRapidoCents(pens, Number(row.rapido_fraction_cents));
      }
      // Older servers may not enforce `min`; never leave a negative balance behind.
      await updateProfileRowById(params.profileRowId, { rapido_pens: 0, rapido_fraction_cents: 0 });
      return 0;
    } catch (error) {
      logServerError('rapido.deduct.atomic', error, { userId: params.userId, costCents });
    }
  }

  const freshRow = params.profileRowId
    ? null
    : await getProfileRowForUser(params.userId);
  const rowId = params.profileRowId ?? freshRow?.$id;
  if (!rowId) {
    throw new Error(`Profile not found for user: ${params.userId}`);
  }

  const current = freshRow ?? await getAdminTables().getRow<UserProfileRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_PROFILES_ID,
    rowId,
  });
  const currentCents = toRapidoCents(Number(current.rapido_pens), Number(current.rapido_fraction_cents));
  const nextCents = Math.max(0, currentCents - costCents);
  const { rapidoPens, rapidoFractionCents } = splitRapidoCents(nextCents);

  await updateProfileRowById(rowId, {
    rapido_pens: rapidoPens,
    rapido_fraction_cents: rapidoFractionCents,
  });
  return nextCents;
}

/**
 * Adds whole Rapido to a profile and returns the new balance. Uses an atomic increment when the
 * profile row id is known, so concurrent charges/credits can't overwrite each other.
 */
export async function creditRapidoPens(
  userId: string,
  profile: Pick<NormalizedUserProfile, 'row_id' | 'rapido_pens'>,
  amount: number,
): Promise<number> {
  const value = Math.max(0, Math.trunc(amount));
  if (value === 0) return profile.rapido_pens;

  if (profile.row_id) {
    const updated = await getAdminTables().incrementRowColumn<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId: profile.row_id,
      column: 'rapido_pens',
      value,
    });
    return Number.isFinite(updated.rapido_pens) ? Number(updated.rapido_pens) : profile.rapido_pens + value;
  }

  const nextBalance = profile.rapido_pens + value;
  await updateProfileById(userId, { rapido_pens: nextBalance });
  return nextBalance;
}
