import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import {
  RuntimeTextLocalizer,
  UI_LANGUAGE_STORAGE_KEY,
  setStoredUiLanguage,
  useLanguage,
} from '@/components/RuntimeTextLocalizer';

function LanguageProbe() {
  const language = useLanguage();
  return <span data-testid="lang">{language}</span>;
}

function clearLanguageCookie() {
  document.cookie = `${UI_LANGUAGE_STORAGE_KEY}=; path=/; max-age=0`;
}

describe('RuntimeTextLocalizer', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearLanguageCookie();
  });

  it('server-renders with the server-resolved language, ignoring browser storage', () => {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, 'en');

    const html = renderToString(
      <RuntimeTextLocalizer initialLanguage="tr">
        <LanguageProbe />
      </RuntimeTextLocalizer>,
    );

    expect(html).toContain('>tr<');
  });

  it('switches to the stored language on mount and backfills the cookie for SSR', () => {
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, 'en');

    render(
      <RuntimeTextLocalizer initialLanguage="tr">
        <LanguageProbe />
      </RuntimeTextLocalizer>,
    );

    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(document.cookie).toContain(`${UI_LANGUAGE_STORAGE_KEY}=en`);
    expect(document.documentElement.lang).toBe('en');
  });

  it('keeps the server language when nothing is stored', () => {
    render(
      <RuntimeTextLocalizer initialLanguage="en">
        <LanguageProbe />
      </RuntimeTextLocalizer>,
    );

    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('updates live when the language is changed via setStoredUiLanguage', () => {
    render(
      <RuntimeTextLocalizer initialLanguage="tr">
        <LanguageProbe />
      </RuntimeTextLocalizer>,
    );

    act(() => {
      setStoredUiLanguage('en');
    });

    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(document.cookie).toContain(`${UI_LANGUAGE_STORAGE_KEY}=en`);
  });
});
