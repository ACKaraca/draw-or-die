'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { normalizeLanguage, type SupportedLanguage } from '@/lib/i18n';

type LanguageEventDetail = {
  language?: string;
};

// Mirrored as a cookie (same name) so app/layout.tsx can render the right language on the server.
export const UI_LANGUAGE_STORAGE_KEY = 'dod_ui_language';
export const LEGACY_LANGUAGE_STORAGE_KEY = 'dod_preferred_language';

const UI_LANGUAGE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

const LanguageContext = createContext<SupportedLanguage>('tr');

// Layout effects run before paint, so a stored language swap does not flash the server default.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function useLanguage(): SupportedLanguage {
  return useContext(LanguageContext);
}

function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLanguageCookie(language: SupportedLanguage): void {
  try {
    document.cookie = `${UI_LANGUAGE_STORAGE_KEY}=${language}; path=/; max-age=${UI_LANGUAGE_COOKIE_MAX_AGE_S}; samesite=lax`;
  } catch {
    // Cookie writes can fail in sandboxed iframes; localStorage remains the source of truth.
  }
}

function readLanguageCookie(): string | null {
  try {
    const match = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${UI_LANGUAGE_STORAGE_KEY}=`));
    return match ? match.slice(UI_LANGUAGE_STORAGE_KEY.length + 1) : null;
  } catch {
    return null;
  }
}

function resolveStoredLanguage(fallback: SupportedLanguage): SupportedLanguage {
  if (typeof window === 'undefined') return fallback;

  const storedLanguage = safeGetItem(UI_LANGUAGE_STORAGE_KEY);
  if (storedLanguage) {
    const fromStorage = normalizeLanguage(storedLanguage, 'tr');
    // Users who picked a language before the cookie existed get it backfilled for SSR.
    if (readLanguageCookie() !== fromStorage) writeLanguageCookie(fromStorage);
    return fromStorage;
  }

  const legacyStoredLanguage = safeGetItem(LEGACY_LANGUAGE_STORAGE_KEY);
  if (legacyStoredLanguage) {
    const fromLegacyStorage = normalizeLanguage(legacyStoredLanguage, 'tr');
    try {
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, fromLegacyStorage);
      window.localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
    } catch {
      // Ignore storage errors; the resolved language is still applied.
    }
    writeLanguageCookie(fromLegacyStorage);
    return fromLegacyStorage;
  }

  const cookieLanguage = readLanguageCookie();
  if (cookieLanguage) return normalizeLanguage(cookieLanguage, fallback);

  return normalizeLanguage(window.navigator.language, fallback);
}

export function setStoredUiLanguage(language: SupportedLanguage): void {
  if (typeof window === 'undefined') return;

  const nextLanguage = normalizeLanguage(language, 'tr');
  try {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage);
  } catch {
    // Ignore storage errors; the cookie + event below still switch the UI.
  }
  writeLanguageCookie(nextLanguage);
  window.dispatchEvent(new CustomEvent<LanguageEventDetail>('dod-language-change', {
    detail: { language: nextLanguage },
  }));
}

interface RuntimeTextLocalizerProps {
  children: ReactNode;
  /** Language resolved on the server (cookie / Accept-Language); must match the SSR markup. */
  initialLanguage?: SupportedLanguage;
}

export function RuntimeTextLocalizer({ children, initialLanguage = 'tr' }: RuntimeTextLocalizerProps) {
  // Start from the server value so hydration matches, then reconcile with browser storage before paint.
  const [clientLanguage, setClientLanguage] = useState<SupportedLanguage>(initialLanguage);
  const language = clientLanguage;

  useIsomorphicLayoutEffect(() => {
    const resolved = resolveStoredLanguage(initialLanguage);
    setClientLanguage((prev) => (prev === resolved ? prev : resolved));
    // Only reconcile once on mount; later changes arrive via the storage/custom events below.
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== UI_LANGUAGE_STORAGE_KEY) return;
      setClientLanguage(normalizeLanguage(event.newValue, 'tr'));
    };

    const onLanguageEvent = (event: Event) => {
      const customEvent = event as CustomEvent<LanguageEventDetail>;
      setClientLanguage(normalizeLanguage(customEvent.detail?.language, 'tr'));
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('dod-language-change', onLanguageEvent as EventListener);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('dod-language-change', onLanguageEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.lang = language;
  }, [language]);

  const contextValue = useMemo(() => language, [language]);

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
}
