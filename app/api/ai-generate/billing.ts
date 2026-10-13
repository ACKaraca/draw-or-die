import { randomUUID } from 'crypto';

import { logServerError, logServerInfo } from '@/lib/logger';
import { createProfileRapidoCounter, deductRapidoCents } from '@/lib/rapido-balance';
import {
  createAppwriteLedgerStore,
  isValidOperationId,
  reserve,
  settle,
  voidReservation,
  type RapidoLedgerDeps,
} from '@/lib/rapido-ledger';
import {
  isRapidoLedgerUsable,
  markRapidoLedgerUnavailableOn,
  resetRapidoLedgerAvailabilityForTests,
} from '@/lib/rapido-ledger-runtime';

// Billing lifecycle for one /api/ai-generate operation: reserve before the AI call, settle only an
// accepted result, void everything else. Falls back to the legacy "charge after success" path when
// the ledger is switched off (RAPIDO_LEDGER_MODE=off), the profile row id is unknown, or the journal
// table has not been provisioned yet.

export type AiBillingMode = 'ledger' | 'legacy';
export type AiBillingShortfallPolicy = 'reject' | 'clamp';

export type OperationIdResolution =
  | { ok: true; operationId: string; isClientSupplied: boolean }
  | { ok: false };

/** Accepts a client idempotency key when well-formed; generates one server-side when absent. */
export function resolveOperationId(raw: unknown): OperationIdResolution {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, operationId: randomUUID(), isClientSupplied: false };
  }
  return isValidOperationId(raw) ? { ok: true, operationId: raw, isClientSupplied: true } : { ok: false };
}

export type AiBillingSettleOutcome =
  | { kind: 'settled'; balanceCents: number }
  | { kind: 'insufficient' };

type SessionInit = {
  mode: AiBillingMode;
  userId: string;
  profileRowId?: string;
  operationId: string;
  requestId: string;
  reservedCents: number;
  balanceAfterReserveCents: number;
  deps: RapidoLedgerDeps | null;
};

export class AiBillingSession {
  readonly mode: AiBillingMode;
  readonly operationId: string;
  readonly reservedCents: number;
  private readonly init: SessionInit;
  private isCloseAttempted = false;

  constructor(init: SessionInit) {
    this.init = init;
    this.mode = init.mode;
    this.operationId = init.operationId;
    this.reservedCents = init.reservedCents;
  }

  /** True until a settle or void has been attempted; the route voids open sessions in `finally`. */
  get isOpen(): boolean {
    return !this.isCloseAttempted;
  }

  async settle(actualCents: number, shortfall: AiBillingShortfallPolicy): Promise<AiBillingSettleOutcome> {
    const { init } = this;
    if (!init.deps) {
      this.isCloseAttempted = true;
      const balanceCents = await deductRapidoCents({
        userId: init.userId,
        profileRowId: init.profileRowId,
        costCents: actualCents,
        knownBalanceCents: init.balanceAfterReserveCents,
      });
      return { kind: 'settled', balanceCents };
    }

    const result = await settle(init.deps, {
      userId: init.userId,
      operationId: init.operationId,
      actualCents,
      shortfall,
    });
    if (result.kind === 'insufficient') return { kind: 'insufficient' };
    this.isCloseAttempted = true;

    if (result.kind === 'settled') {
      const fallback = init.balanceAfterReserveCents + init.reservedCents - result.chargedCents;
      if (result.shortfallCents > 0) {
        logServerInfo('rapido.ledger.settle_shortfall', {
          requestId: init.requestId,
          operationId: init.operationId,
          shortfallCents: result.shortfallCents,
        });
      }
      return { kind: 'settled', balanceCents: Math.max(0, result.balanceCents ?? fallback) };
    }

    logServerError('rapido.ledger.settle_unexpected', new Error(`settle returned ${result.kind}`), {
      requestId: init.requestId,
      operationId: init.operationId,
    });
    return { kind: 'settled', balanceCents: init.balanceAfterReserveCents };
  }

  /** Closes the operation with zero spend. Never throws; failures are logged for reconciliation. */
  async void(reason: string): Promise<void> {
    if (this.isCloseAttempted) return;
    this.isCloseAttempted = true;
    const { init } = this;
    if (!init.deps) return;
    try {
      await voidReservation(init.deps, { userId: init.userId, operationId: init.operationId, reason });
    } catch (error) {
      // The reservation stays open; its lease expiry lets the sweeper return the value.
      logServerError('rapido.ledger.void_failed', error, {
        requestId: init.requestId,
        operationId: init.operationId,
        reason,
      });
    }
  }
}

export type AiBillingOpenResult =
  | { kind: 'opened'; session: AiBillingSession }
  | { kind: 'insufficient' }
  | { kind: 'duplicate'; state: 'open' | 'settled' | 'voided' };

export async function openAiBilling(params: {
  userId: string;
  profileRowId?: string;
  operationId: string;
  operation: string;
  requestId: string;
  amountCents: number;
  knownBalanceCents: number;
}): Promise<AiBillingOpenResult> {
  const legacy = (): AiBillingOpenResult => ({
    kind: 'opened',
    session: new AiBillingSession({
      mode: 'legacy',
      userId: params.userId,
      profileRowId: params.profileRowId,
      operationId: params.operationId,
      requestId: params.requestId,
      reservedCents: 0,
      balanceAfterReserveCents: params.knownBalanceCents,
      deps: null,
    }),
  });

  if (!params.profileRowId || !isRapidoLedgerUsable()) {
    return legacy();
  }

  const deps: RapidoLedgerDeps = {
    store: createAppwriteLedgerStore(),
    counter: createProfileRapidoCounter({ userId: params.userId, profileRowId: params.profileRowId }),
  };

  let result: Awaited<ReturnType<typeof reserve>>;
  try {
    result = await reserve(deps, {
      userId: params.userId,
      operationId: params.operationId,
      operation: params.operation,
      amountCents: params.amountCents,
    });
  } catch (error) {
    if (markRapidoLedgerUnavailableOn(error, { requestId: params.requestId })) return legacy();
    throw error;
  }

  if (result.kind !== 'reserved') return result;

  const reservedCents = result.reservedCents;
  return {
    kind: 'opened',
    session: new AiBillingSession({
      mode: 'ledger',
      userId: params.userId,
      profileRowId: params.profileRowId,
      operationId: params.operationId,
      requestId: params.requestId,
      reservedCents,
      balanceAfterReserveCents: result.balanceCents ?? Math.max(0, params.knownBalanceCents - reservedCents),
      deps,
    }),
  };
}

/** Test hook: forget a cached "ledger table missing" decision. */
export function resetLedgerAvailabilityForTests(): void {
  resetRapidoLedgerAvailabilityForTests();
}
