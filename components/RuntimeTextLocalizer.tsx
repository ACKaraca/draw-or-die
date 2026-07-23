'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { normalizeLanguage, type SupportedLanguage } from '@/lib/i18n';

type LanguageEventDetail = {
  language?: string;
};

export const UI_LANGUAGE_STORAGE_KEY = 'dod_ui_language';
export const LEGACY_LANGUAGE_STORAGE_KEY = 'dod_preferred_language';

const LanguageContext = createContext<SupportedLanguage>('tr');

export function useLanguage(): SupportedLanguage {
  return useContext(LanguageContext);
}

function resolveStoredLanguage(): SupportedLanguage {
  if (typeof window !== 'undefined') {
    const storedLanguage = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
    if (storedLanguage) return normalizeLanguage(storedLanguage, 'tr');

    const legacyStoredLanguage = window.localStorage.getItem(LEGACY_LANGUAGE_STORAGE_KEY);
    if (legacyStoredLanguage) {
      const fromLegacyStorage = normalizeLanguage(legacyStoredLanguage, 'tr');
      window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, fromLegacyStorage);
      window.localStorage.removeItem(LEGACY_LANGUAGE_STORAGE_KEY);
      return fromLegacyStorage;
    }

    return normalizeLanguage(window.navigator.language, 'tr');
  }

  return 'tr';
}

export function setStoredUiLanguage(language: SupportedLanguage): void {
  if (typeof window === 'undefined') return;

  const nextLanguage = normalizeLanguage(language, 'tr');
  window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage);
  window.dispatchEvent(new CustomEvent<LanguageEventDetail>('dod-language-change', {
    detail: { language: nextLanguage },
  }));
}

interface RuntimeTextLocalizerProps {
  children: ReactNode;
}

export function RuntimeTextLocalizer({ children }: RuntimeTextLocalizerProps) {
  const [clientLanguage, setClientLanguage] = useState<SupportedLanguage>(() => resolveStoredLanguage());
  const language = clientLanguage;

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
