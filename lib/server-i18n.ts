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
  const match = /(?:^|;\s*)dod_preferred_language=([^;]+)/i.exec(cookieHeader);
  if (!match?.[1]) return fallback;
  return normalizeLanguage(decodeURIComponent(match[1].trim()), fallback);
}
