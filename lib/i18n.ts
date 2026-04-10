export type SupportedLanguage = 'tr' | 'en';

const SUPPORTED_LANGUAGES = new Set<SupportedLanguage>(['tr', 'en']);

function toPrimaryLanguage(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace('_', '-')
    .split('-')[0] || '';
}

export function normalizeLanguage(value: unknown, fallback: SupportedLanguage = 'tr'): SupportedLanguage {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const primary = toPrimaryLanguage(value);
  if (SUPPORTED_LANGUAGES.has(primary as SupportedLanguage)) {
    return primary as SupportedLanguage;
  }
  return fallback;
}

export function resolveLanguageFromAcceptLanguage(
  headerValue: string | null | undefined,
  fallback: SupportedLanguage = 'tr',
): SupportedLanguage {
  if (!headerValue) return fallback;

  const candidates = headerValue
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split(';')[0] ?? '')
    .map((entry) => normalizeLanguage(entry, fallback));

  return candidates[0] ?? fallback;
}

export function pickLocalized(language: SupportedLanguage, trText: string, enText: string): string {
  return language === 'en' ? enText : trText;
}
