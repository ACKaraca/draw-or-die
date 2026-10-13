import { logServerError, logServerInfo } from '@/lib/logger';
import { computeSubjectHash, type DeletionDenyScope, type DeletionRequestStore } from '@/lib/privacy/deletion';
import { createAppwriteDeletionStore } from '@/lib/privacy/deletion-store';
import { PrivacyApiMessages } from '@/lib/privacy/messages';
import type { SupportedLanguage } from '@/lib/i18n';

/** `account` = any deletion request blocks (re)creating the subject's account data, e.g. the profile row. */
export type SubjectGuardScope = DeletionDenyScope | 'account';

export type SubjectGuardDenial = {
  status: 410 | 503;
  body: { error: string; code: 'ACCOUNT_DELETION_REQUESTED' | 'PRIVACY_CHECK_UNAVAILABLE' };
};

const DENIED_CACHE_MAX = 1000;

// Tombstones are never cleared, so a denial is safe to cache for the life of the instance.
// Allowed results are never cached: a fresh deletion request must take effect on the next call.
const deniedScopesByHash = new Map<string, readonly string[]>();

function cacheDenied(subjectHash: string, scopes: readonly string[]): void {
  if (deniedScopesByHash.size >= DENIED_CACHE_MAX) {
    const oldest = deniedScopesByHash.keys().next().value;
    if (oldest !== undefined) deniedScopesByHash.delete(oldest);
  }
  deniedScopesByHash.set(subjectHash, scopes);
}

function isScopeDenied(scopes: readonly string[], scope: SubjectGuardScope): boolean {
  return scope === 'account' || scopes.includes(scope);
}

/**
 * Downstream enforcement of the deletion tombstone. Returns null when the subject may proceed,
 * otherwise a response the route returns as-is. Fails closed: if the deletion store cannot be read,
 * new personal data must not be written or processed for a subject that may have asked to be erased.
 */
export async function checkSubjectAllowed(
  userId: string,
  scope: SubjectGuardScope,
  lang: SupportedLanguage,
  store: DeletionRequestStore = createAppwriteDeletionStore(),
): Promise<SubjectGuardDenial | null> {
  const subjectHash = computeSubjectHash(userId);
  let scopes = deniedScopesByHash.get(subjectHash);

  if (!scopes) {
    try {
      const record = await store.get(subjectHash);
      if (!record) return null;
      scopes = record.tombstone.denyScopes;
      cacheDenied(subjectHash, scopes);
    } catch (error) {
      logServerError('privacy.subject_guard.lookup_failed', error, { subjectHash, scope });
      return {
        status: 503,
        body: { error: PrivacyApiMessages.privacyCheckUnavailable(lang), code: 'PRIVACY_CHECK_UNAVAILABLE' },
      };
    }
  }

  if (!isScopeDenied(scopes, scope)) return null;
  logServerInfo('privacy.subject_guard.denied', { subjectHash, scope });
  return {
    status: 410,
    body: { error: PrivacyApiMessages.accountDeletionRequested(lang), code: 'ACCOUNT_DELETION_REQUESTED' },
  };
}

/** Test-only: the denial cache is process-wide. */
export function resetSubjectGuardCache(): void {
  deniedScopesByHash.clear();
}
