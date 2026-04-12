'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { normalizeLanguage, type SupportedLanguage } from '@/lib/i18n';

type LanguageEventDetail = {
  language?: string;
};

const LanguageContext = createContext<SupportedLanguage>('tr');

export function useLanguage(): SupportedLanguage {
  return useContext(LanguageContext);
}

function resolveStoredLanguage(): SupportedLanguage {
  if (typeof window !== 'undefined') {
    const fromStorage = normalizeLanguage(window.localStorage.getItem('dod_preferred_language'), undefined);
    if (fromStorage) return fromStorage;

    const fromNavigator = normalizeLanguage(window.navigator.language, undefined);
    if (fromNavigator) return fromNavigator;
  }

  return 'tr';
}

interface RuntimeTextLocalizerProps {
  children: ReactNode;
}

export function RuntimeTextLocalizer({ children }: RuntimeTextLocalizerProps) {
  const { profile } = useAuth();
  const [clientLanguage, setClientLanguage] = useState<SupportedLanguage>(() => resolveStoredLanguage());
  const language = normalizeLanguage(profile?.preferred_language, clientLanguage);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'dod_preferred_language') return;
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
