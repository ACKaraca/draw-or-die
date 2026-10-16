import { logServerInfo } from '@/lib/logger';
import { createProfileRapidoCounter, type RapidoBalanceCounter } from '@/lib/rapido-balance';
import {
  createAppwriteLedgerStore,
  grant,
  isLedgerTableMissing,
  type RapidoLedgerDeps,
  type RapidoValueBucket,
} from '@/lib/rapido-ledger';

// Shared on/off + availability state for every runtime writer of the Rapido journal (AI billing,
// Stripe entitlements, rewards, promo codes). The ledger is skipped (callers use their legacy
// counter write) when RAPIDO_LEDGER_MODE=off, or for a cooldown after the journal table turned
// out to be missing, so production keeps working before the table is provisioned.

const LEDGER_UNAVAILABLE_COOLDOWN_MS = 5 * 60 * 1000;
let ledgerUnavailableUntil = 0;

// Journal-only writers mutate the counter themselves (e.g. inside an Appwrite transaction), so the
// ledger must append the entry without touching the balance again.
const JOURNAL_ONLY_COUNTER: RapidoBalanceCounter = {
  debit: async () => ({ ok: true, balanceCents: null }),
  credit: async () => null,
  read: async () => 0,
};

export function isRapidoLedgerUsable(): boolean {
  const isSwitchedOn = (process.env.RAPIDO_LEDGER_MODE ?? '').trim().toLowerCase() !== 'off';
  return isSwitchedOn && Date.now() >= ledgerUnavailableUntil;
}

/** True (and starts the cooldown) when `error` means the journal table is not provisioned. */
export function markRapidoLedgerUnavailableOn(error: unknown, context: Record<string, unknown> = {}): boolean {
  if (!isLedgerTableMissing(error)) return false;
  ledgerUnavailableUntil = Date.now() + LEDGER_UNAVAILABLE_COOLDOWN_MS;
  logServerInfo('rapido.ledger.unavailable', { ...context, fallback: 'legacy' });
  return true;
}

export function resetRapidoLedgerAvailabilityForTests(): void {
  ledgerUnavailableUntil = 0;
}

/**
 * Runs `run` against the Appwrite journal. Returns `null` when the ledger is off, the profile row is
 * unknown (counter mode) or the journal table is missing: the caller then uses its legacy write.
 */
export async function withRapidoLedger<T>(
  ref: { userId: string; profileRowId?: string | null; isJournalOnly?: boolean },
  run: (deps: RapidoLedgerDeps) => Promise<T>,
): Promise<{ value: T } | null> {
  if (!isRapidoLedgerUsable()) return null;
  let counter = JOURNAL_ONLY_COUNTER;
  if (!ref.isJournalOnly) {
    if (!ref.profileRowId) return null;
    counter = createProfileRapidoCounter({ userId: ref.userId, profileRowId: ref.profileRowId });
  }
  try {
    return { value: await run({ store: createAppwriteLedgerStore(), counter }) };
  } catch (error) {
    if (markRapidoLedgerUnavailableOn(error, { userId: ref.userId })) return null;
    throw error;
  }
}

/**
 * Credits the profile counter through a journaled `grant` (idempotent per `sourceId`). Returns the
 * balance after the credit in cents (best known), or `null` when the caller must use its legacy credit.
 */
export async function creditRapidoThroughLedger(input: {
  userId: string;
  profileRowId?: string | null;
  sourceId: string;
  bucket: RapidoValueBucket;
  amountCents: number;
  knownBalanceCents: number;
  reason: string;
}): Promise<number | null> {
  if (input.amountCents <= 0) return null;
  const result = await withRapidoLedger(input, (deps) =>
    grant(deps, {
      userId: input.userId,
      sourceId: input.sourceId,
      kind: 'grant',
      bucket: input.bucket,
      amountCents: input.amountCents,
      reason: input.reason,
    }),
  );
  if (!result) return null;
  if (result.value.kind === 'duplicate') return input.knownBalanceCents;
  return result.value.balanceCents ?? input.knownBalanceCents + input.amountCents;
}
