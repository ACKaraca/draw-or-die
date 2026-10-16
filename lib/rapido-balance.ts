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
import { getAppwriteErrorDetails, isAppwriteColumnNotAvailable } from '@/lib/appwrite/error-utils';
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

// ---------------------------------------------------------------------------------------------
// Atomic cents counter used by the Rapido ledger (lib/rapido-ledger.ts).
//
// The legacy balance is stored as `rapido_pens` (whole Rapido) + `rapido_fraction_cents` (0..99).
// Every mutation below is a single Appwrite atomic increment/decrement with a floor/ceiling, so no
// code path ever writes an absolute balance computed from a stale read. Fractional amounts borrow
// or carry one whole Rapido with two atomic steps; the transient state between the two steps can
// only *under*-report the balance, never let it go negative or mint value.
// ---------------------------------------------------------------------------------------------

const MAX_FRACTION_ATTEMPTS = 32;
const PENS_COLUMN = 'rapido_pens';
const FRACTION_COLUMN = 'rapido_fraction_cents';
const FRACTION_MAX = RAPIDO_PRECISION_SCALE - 1;

export type RapidoCounterRef = {
  userId: string;
  profileRowId: string;
};

export type RapidoDebitResult =
  | { ok: true; balanceCents: number | null }
  | { ok: false; reason: 'insufficient' };

/** The atomic balance primitive the ledger depends on; injectable so tests can use an in-memory fake. */
export type RapidoBalanceCounter = {
  debit(cents: number): Promise<RapidoDebitResult>;
  credit(cents: number): Promise<number | null>;
  read(): Promise<number>;
};

function isLimitViolation(error: unknown): boolean {
  if (isAppwriteColumnNotAvailable(error)) return false;
  const details = getAppwriteErrorDetails(error);
  const status = details.code ?? details.status ?? details.responseCode ?? details.responseStatus;
  return status === 400;
}

function rowToCents(row: UserProfileRow): number {
  return toRapidoCents(Number(row.rapido_pens), Number(row.rapido_fraction_cents));
}

async function atomicDecrement(rowId: string, column: string, value: number): Promise<UserProfileRow | null> {
  const tables = getAdminTables();
  let row: UserProfileRow;
  try {
    row = await tables.decrementRowColumn<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId,
      column,
      value,
      min: 0,
    });
  } catch (error) {
    if (isLimitViolation(error)) return null;
    throw error;
  }
  const next = Number(row[column as keyof UserProfileRow]);
  if (Number.isFinite(next) && next < 0) {
    // Servers that ignore `min` still applied the decrement; undo it and report "insufficient".
    await tables.incrementRowColumn<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId,
      column,
      value,
    });
    return null;
  }
  return row;
}

async function atomicIncrement(
  rowId: string,
  column: string,
  value: number,
  max?: number,
): Promise<UserProfileRow | null> {
  const tables = getAdminTables();
  let row: UserProfileRow;
  try {
    row = await tables.incrementRowColumn<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId,
      column,
      value,
      ...(max === undefined ? {} : { max }),
    });
  } catch (error) {
    if (max !== undefined && isLimitViolation(error)) return null;
    throw error;
  }
  const next = Number(row[column as keyof UserProfileRow]);
  if (max !== undefined && Number.isFinite(next) && next > max) {
    await tables.decrementRowColumn<UserProfileRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PROFILES_ID,
      rowId,
      column,
      value,
    });
    return null;
  }
  return row;
}

async function subtractFraction(rowId: string, cents: number): Promise<UserProfileRow | null> {
  for (let attempt = 0; attempt < MAX_FRACTION_ATTEMPTS; attempt += 1) {
    const direct = await atomicDecrement(rowId, FRACTION_COLUMN, cents);
    if (direct) return direct;

    // fraction < cents: borrow one whole Rapido, then add back the change (100 - cents).
    const borrowed = await atomicDecrement(rowId, PENS_COLUMN, 1);
    if (!borrowed) return null;
    const changed = await atomicIncrement(rowId, FRACTION_COLUMN, RAPIDO_PRECISION_SCALE - cents, FRACTION_MAX);
    if (changed) return changed;

    // A concurrent credit raised the fraction in between; return the borrowed Rapido and retry.
    await atomicIncrement(rowId, PENS_COLUMN, 1);
  }
  return null;
}

async function addFraction(rowId: string, cents: number): Promise<UserProfileRow> {
  for (let attempt = 0; attempt < MAX_FRACTION_ATTEMPTS; attempt += 1) {
    const direct = await atomicIncrement(rowId, FRACTION_COLUMN, cents, FRACTION_MAX);
    if (direct) return direct;

    // fraction + cents >= 100: carry. Remove (100 - cents) from the fraction, then add one Rapido.
    const lowered = await atomicDecrement(rowId, FRACTION_COLUMN, RAPIDO_PRECISION_SCALE - cents);
    if (!lowered) continue;
    const carried = await atomicIncrement(rowId, PENS_COLUMN, 1);
    if (carried) return carried;
  }
  throw new Error(`Rapido fraction credit did not converge for row ${rowId}`);
}

/** Atomically removes `cents` from the balance, or reports `insufficient` without changing anything. */
export async function debitRapidoCentsAtomic(ref: RapidoCounterRef, cents: number): Promise<RapidoDebitResult> {
  const amount = Math.max(0, Math.round(cents));
  if (amount === 0) return { ok: true, balanceCents: null };

  const whole = Math.floor(amount / RAPIDO_PRECISION_SCALE);
  const fraction = amount % RAPIDO_PRECISION_SCALE;
  let lastRow: UserProfileRow | null = null;

  if (whole > 0) {
    lastRow = await atomicDecrement(ref.profileRowId, PENS_COLUMN, whole);
    if (!lastRow) return { ok: false, reason: 'insufficient' };
  }

  if (fraction > 0) {
    let fractionRow: UserProfileRow | null = null;
    try {
      fractionRow = await subtractFraction(ref.profileRowId, fraction);
    } catch (error) {
      if (whole > 0) await atomicIncrement(ref.profileRowId, PENS_COLUMN, whole);
      throw error;
    }
    if (!fractionRow) {
      if (whole > 0) await atomicIncrement(ref.profileRowId, PENS_COLUMN, whole);
      return { ok: false, reason: 'insufficient' };
    }
    lastRow = fractionRow;
  }

  return { ok: true, balanceCents: lastRow ? rowToCents(lastRow) : null };
}

/** Atomically adds `cents` to the balance and returns the balance the last write observed. */
export async function creditRapidoCentsAtomic(ref: RapidoCounterRef, cents: number): Promise<number | null> {
  const amount = Math.max(0, Math.round(cents));
  if (amount === 0) return null;

  const whole = Math.floor(amount / RAPIDO_PRECISION_SCALE);
  const fraction = amount % RAPIDO_PRECISION_SCALE;
  let lastRow: UserProfileRow | null = null;

  if (whole > 0) {
    lastRow = await atomicIncrement(ref.profileRowId, PENS_COLUMN, whole);
  }
  if (fraction > 0) {
    lastRow = await addFraction(ref.profileRowId, fraction);
  }
  return lastRow ? rowToCents(lastRow) : null;
}

export function createProfileRapidoCounter(ref: RapidoCounterRef): RapidoBalanceCounter {
  return {
    debit: (cents) => debitRapidoCentsAtomic(ref, cents),
    credit: (cents) => creditRapidoCentsAtomic(ref, cents),
    read: async () => {
      const row = await getAdminTables().getRow<UserProfileRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_PROFILES_ID,
        rowId: ref.profileRowId,
      });
      return rowToCents(row);
    },
  };
}
