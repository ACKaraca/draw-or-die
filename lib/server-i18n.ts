import type { NextRequest } from 'next/server';
import { normalizeLanguage, resolveLanguageFromAcceptLanguage, type SupportedLanguage } from '@/lib/i18n';

/** Cookie name for persisted UI language (must stay in sync with client `document.cookie` writers). */
export const DOD_PREFERRED_LANGUAGE_COOKIE = 'dod_preferred_language';

/**
 * Resolves UI/API message language for a request (defaults to Turkish).
 */
export function getRequestLanguage(request: NextRequest, fallback: SupportedLanguage = 'tr'): SupportedLanguage {
  const header = request.headers.get('accept-language');
  return resolveLanguageFromAcceptLanguage(header, fallback);
}

export function getLanguageFromCookieHeader(
  cookieHeader: string | null,
  fallback: SupportedLanguage = 'tr',
): SupportedLanguage {
  if (!cookieHeader) return fallback;

  let start = 0;
  while (start <= cookieHeader.length) {
    const sep = cookieHeader.indexOf(';', start);
    const segmentEnd = sep === -1 ? cookieHeader.length : sep;
    const segment = cookieHeader.slice(start, segmentEnd);
    const eq = segment.indexOf('=');
    if (eq !== -1) {
      const key = segment.slice(0, eq).trim();
      if (key.toLowerCase() === DOD_PREFERRED_LANGUAGE_COOKIE) {
        const rawValue = segment.slice(eq + 1).trim();
        if (!rawValue) return fallback;
        try {
          return normalizeLanguage(decodeURIComponent(rawValue), fallback);
        } catch {
          return normalizeLanguage(rawValue, fallback);
        }
      }
    }
    if (sep === -1) break;
    start = sep + 1;
  }

  return fallback;
}
