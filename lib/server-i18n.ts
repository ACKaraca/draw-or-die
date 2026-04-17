import type { NextRequest } from 'next/server';
import { normalizeLanguage, resolveLanguageFromAcceptLanguage, type SupportedLanguage } from '@/lib/i18n';

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

  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawKey, ...rawRest] = part.split('=');
    if (!rawKey) continue;

    const key = rawKey.trim();
    if (key.toLowerCase() === 'dod_preferred_language') {
      const rawValue = rawRest.join('=').trim();
      if (!rawValue) continue;

      try {
        return normalizeLanguage(decodeURIComponent(rawValue), fallback);
      } catch {
        return normalizeLanguage(rawValue, fallback);
      }
    }
  }

  return fallback;
}
