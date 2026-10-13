/**
 * Single server-owned moderation policy for every public surface (Hall of Fame, Wall of Death,
 * Community, Confessions). The only path to `approved` is an explicit SAFE verdict from the
 * moderation model on content that shows no prompt-injection markers. Everything uncertain
 * (outage, missing key, non-2xx, unparsable output, injection suspicion) stays `pending`.
 */

export type ModerationCategory = 'SAFE' | 'SENSITIVE' | 'REJECT';

export type PendingCause = 'unavailable' | 'uncertain' | 'injection_suspected';

export type ModerationVerdict =
  | { kind: 'approved'; reason: string; category: 'SAFE' }
  | { kind: 'rejected'; reason: string; category: 'SENSITIVE' | 'REJECT' }
  | { kind: 'pending'; reason: string; cause: PendingCause };

export type PublicationDecision = 'approved' | 'pending' | 'rejected';

export const PUBLIC_GALLERY_STATUS = 'approved';
export const MODERATION_PENDING_REASON = 'Queued for manual review.';
export const MODERATION_UNAVAILABLE_REASON = 'Moderation unavailable. Queued for manual review.';
export const MODERATION_INJECTION_REASON = 'Possible instruction injection. Queued for manual review.';
const MAX_REASON_LENGTH = 500;

/** Fields a client could send to try to choose its own approval state. They are always ignored. */
export const CLIENT_APPROVAL_FIELDS = ['autoApproved', 'approved', 'status', 'moderationStatus', 'isApproved'] as const;

const PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass)\b.{0,40}\b(previous|prior|above|earlier|system|all|any)\b.{0,30}\b(instruction|instructions|prompt|prompts|rule|rules|guideline|guidelines|policy)\b/i,
  /\b(system|developer)\s*(prompt|message|override|instruction)/i,
  /\b(you\s+are\s+now|act\s+as|pretend\s+to\s+be)\b.{0,30}\b(moderator|admin|administrator|system|validator)\b/i,
  /\b(mark|set|flag|classify|label|treat)\b.{0,30}\bas\s+(approved|safe|allowed)\b/i,
  /["']?\b(approved|isApproved|autoApproved)\b["']?\s*[:=]\s*["']?true\b/i,
  /["']?\bcategory\b["']?\s*[:=]\s*["']?safe\b/i,
  /["']?\bstatus\b["']?\s*[:=]\s*["']?approved\b/i,
  /<\s*\/?\s*(untrusted_content|system|assistant|instructions?)\s*>/i,
  /(önceki|yukarıdaki|tüm).{0,30}(talimat|kural|komut).{0,30}(yok\s*say|unut|görmezden\s*gel|uyma)/i,
  /(onaylandı|onaylı|güvenli)\s+olarak\s+(işaretle|döndür|say)/i,
];

const INVISIBLE_CHARS = /[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g;

function normalizeForInspection(text: string): string {
  return text.normalize('NFKC').replace(INVISIBLE_CHARS, '').replace(/\s+/g, ' ');
}

export function detectPromptInjection(...texts: ReadonlyArray<string | null | undefined>): boolean {
  return texts.some((text) => {
    if (!text) return false;
    const normalized = normalizeForInspection(text);
    return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
  });
}

export function findClientApprovalFields(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const record = body as Record<string, unknown>;
  return CLIENT_APPROVAL_FIELDS.filter((field) => field in record);
}

function stripCodeFence(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

function trimReason(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.substring(0, MAX_REASON_LENGTH) : fallback;
}

export function pendingVerdict(cause: PendingCause): ModerationVerdict {
  switch (cause) {
    case 'unavailable':
      return { kind: 'pending', reason: MODERATION_UNAVAILABLE_REASON, cause };
    case 'injection_suspected':
      return { kind: 'pending', reason: MODERATION_INJECTION_REASON, cause };
    case 'uncertain':
      return { kind: 'pending', reason: MODERATION_PENDING_REASON, cause };
    default: {
      const _exhaustive: never = cause;
      throw new Error(`Unknown pending cause: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Strict parse of the moderation model's message content. Approval needs BOTH
 * `approved === true` (boolean, not "true") AND `category === "SAFE"`; any other shape is
 * treated as uncertain and stays pending.
 */
export function parseModerationVerdict(rawContent: unknown): ModerationVerdict {
  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    return pendingVerdict('uncertain');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(rawContent));
  } catch {
    return pendingVerdict('uncertain');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return pendingVerdict('uncertain');
  }

  const record = parsed as Record<string, unknown>;
  const category = record.category;

  if (record.approved === true && category === 'SAFE') {
    return { kind: 'approved', reason: trimReason(record.reason, 'Meets community guidelines.'), category: 'SAFE' };
  }

  if (record.approved === false) {
    return {
      kind: 'rejected',
      reason: trimReason(record.reason, 'Content does not meet community guidelines.'),
      category: category === 'SENSITIVE' ? 'SENSITIVE' : 'REJECT',
    };
  }

  return pendingVerdict('uncertain');
}

/**
 * Final server decision. Injection markers in user-controlled text always win over a model
 * approval, because a successful injection would look exactly like a SAFE verdict.
 */
export function decidePublication(
  verdict: ModerationVerdict,
  context: { isInjectionSuspected: boolean },
): PublicationDecision {
  if (verdict.kind === 'rejected') return 'rejected';
  if (context.isInjectionSuspected) return 'pending';
  if (verdict.kind === 'approved') return 'approved';
  return 'pending';
}

export function isPubliclyVisibleGalleryRow(row: { status?: string | null; revoked_at?: string | null }): boolean {
  return row.status === PUBLIC_GALLERY_STATUS && !row.revoked_at;
}
