export type CookieConsentStatus = 'accepted' | 'rejected' | 'unset';

export const COOKIE_CONSENT_STORAGE_KEY = 'draw_or_die_cookie_consent_v1';

export function normalizeCookieConsentStatus(value: string | null | undefined): CookieConsentStatus {
  if (value === 'accepted' || value === 'rejected') {
    return value;
  }
  return 'unset';
}

export function readCookieValueFromDocument(cookieName: string): string | null {
  if (typeof document === 'undefined' || !cookieName) return null;

  const source = document.cookie || '';
  if (!source) return null;

  const parts = source.split(';');
  for (const part of parts) {
    const [rawKey, ...rawRest] = part.split('=');
    if (!rawKey) continue;

    const key = rawKey.trim();
    if (key !== cookieName) continue;

    const rawValue = rawRest.join('=').trim();
    if (!rawValue) return '';

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}
