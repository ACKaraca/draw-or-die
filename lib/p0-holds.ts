import { NextResponse } from 'next/server';

import { getFeatureFlag } from '@/lib/appwrite/server';
import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';
import { logServerError } from '@/lib/logger';

/**
 * P0 containment holds (docs/enterprise-audit/P0-CONTAINMENT-RUNBOOK.md).
 *
 * Every hold is ACTIVE unless a valid release record exists in the `feature_flags` table under
 * `p0_hold_<id>`. A missing row, an unreadable table, malformed JSON or a record for another
 * environment all keep the hold active, so a configuration failure never opens a risky side effect.
 * Holds are restrictive and reversible; they never delete or rewrite customer data.
 */
export const P0_HOLD_IDS = [
  'gallery_public',
  'rewards',
  'checkout',
  'stripe_effects',
  'edu_verification',
  'paid_ai_wallet',
  'ai_model',
] as const;

export type P0HoldId = (typeof P0_HOLD_IDS)[number];

export const P0_HOLD_FLAG_PREFIX = 'p0_hold_';

/** Fields the runbook requires for every hold; all must be present for a release to count. */
export const P0_HOLD_RELEASE_FIELDS = [
  'owner',
  'reason',
  'environment',
  'configVersion',
  'startedAt',
  'reviewAt',
  'reenableGate',
] as const;

type ReleaseField = (typeof P0_HOLD_RELEASE_FIELDS)[number];

export type P0HoldRelease = Record<ReleaseField, string> & { state: 'released' };

// A release or re-hold made in Appwrite reaches each server instance within this window.
const HOLD_CACHE_TTL_MS = 15 * 1000;
// A failed read keeps the hold active; retry soon so recovery does not wait a full TTL.
const HOLD_ERROR_CACHE_TTL_MS = 5 * 1000;

const holdCache = new Map<P0HoldId, { isActive: boolean; expiresAt: number }>();

export function getHoldFlagKey(id: P0HoldId): string {
  return `${P0_HOLD_FLAG_PREFIX}${id}`;
}

export function resolveHoldEnvironment(): string {
  return process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV || 'development';
}

/**
 * A hold counts as released only when its flag row has `enabled: false` (hold switched off) and a
 * `value_json` record with `state: 'released'` plus every runbook field for this environment.
 */
export function parseHoldRelease(
  row: { enabled: boolean; value_json?: string } | null,
  environment: string,
): P0HoldRelease | null {
  if (!row || row.enabled !== false || !row.value_json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.value_json);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (record.state !== 'released') return null;

  const release: Partial<Record<ReleaseField, string>> = {};
  for (const field of P0_HOLD_RELEASE_FIELDS) {
    const value = record[field];
    if (typeof value !== 'string' || !value.trim()) return null;
    release[field] = value.trim();
  }

  if (release.environment !== environment) return null;

  return { ...(release as Record<ReleaseField, string>), state: 'released' };
}

export async function isHoldActive(id: P0HoldId): Promise<boolean> {
  const now = Date.now();
  const cached = holdCache.get(id);
  if (cached && cached.expiresAt > now) return cached.isActive;

  let isActive = true;
  let ttlMs = HOLD_CACHE_TTL_MS;
  try {
    const row = await getFeatureFlag(getHoldFlagKey(id));
    isActive = parseHoldRelease(row, resolveHoldEnvironment()) === null;
  } catch (error) {
    logServerError('p0-holds.read', error, { holdId: id });
    ttlMs = HOLD_ERROR_CACHE_TTL_MS;
  }

  holdCache.set(id, { isActive, expiresAt: now + ttlMs });
  return isActive;
}

/** Test helper: drops cached hold state so the next read goes to the flag table. */
export function resetHoldCache(): void {
  holdCache.clear();
}

const HOLD_MESSAGES: Record<P0HoldId, { tr: string; en: string }> = {
  gallery_public: {
    tr: 'Galeri paylaşımları güvenlik nedeniyle geçici olarak kapalı. Çalışmaların ve verilerin korunuyor.',
    en: 'Gallery sharing is temporarily unavailable for safety reasons. Your work and data are preserved.',
  },
  rewards: {
    tr: 'Ödül ve kod kullanımı geçici olarak durduruldu. Mevcut bakiyen etkilenmedi.',
    en: 'Rewards and code redemption are temporarily paused. Your existing balance is unaffected.',
  },
  checkout: {
    tr: 'Yeni ödemeler geçici olarak durduruldu. Mevcut aboneliğini yönetebilir ve destekle iletişime geçebilirsin.',
    en: 'New purchases are temporarily paused. You can still manage your subscription and contact support.',
  },
  stripe_effects: {
    tr: 'Ödeme olayı işleme geçici olarak durduruldu; olay daha sonra yeniden işlenecek.',
    en: 'Payment event processing is temporarily paused; the event will be processed later.',
  },
  edu_verification: {
    tr: 'Öğrenci doğrulaması geçici olarak kapalı. Hesabın ve mevcut erişimin etkilenmedi.',
    en: 'Student verification is temporarily unavailable. Your account and current access are unaffected.',
  },
  paid_ai_wallet: {
    tr: 'Ücretli AI işlemleri geçici olarak durduruldu. Rapido bakiyen ve geçmişin korunuyor.',
    en: 'Paid AI operations are temporarily paused. Your Rapido balance and history are preserved.',
  },
  ai_model: {
    tr: 'AI modeli doğrulanana kadar ücretli işlemler geçici olarak durduruldu. Rapido bakiyen korunuyor.',
    en: 'Paid operations are paused until the AI model is verified. Your Rapido balance is preserved.',
  },
};

/** Body that tells the truth about the pause and the customer's data/value. */
export function holdUnavailablePayload(
  id: P0HoldId,
  language: SupportedLanguage,
): { error: string; code: 'CAPABILITY_ON_HOLD'; hold: P0HoldId } {
  const message = HOLD_MESSAGES[id];
  return {
    error: pickLocalized(language, message.tr, message.en),
    code: 'CAPABILITY_ON_HOLD',
    hold: id,
  };
}

export function holdUnavailableResponse(id: P0HoldId, language: SupportedLanguage): NextResponse {
  return NextResponse.json(holdUnavailablePayload(id, language), {
    status: 503,
    headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' },
  });
}

/** Returns the 503 response when the hold is active, otherwise null so callers can continue. */
export async function rejectIfHeld(id: P0HoldId, language: SupportedLanguage): Promise<NextResponse | null> {
  return (await isHoldActive(id)) ? holdUnavailableResponse(id, language) : null;
}
