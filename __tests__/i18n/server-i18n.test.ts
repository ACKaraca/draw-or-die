import { DOD_PREFERRED_LANGUAGE_COOKIE, getLanguageFromCookieHeader } from '@/lib/server-i18n';

describe('getLanguageFromCookieHeader', () => {
  it('returns fallback when cookieHeader is null', () => {
    expect(getLanguageFromCookieHeader(null, 'en')).toBe('en');
  });

  it('returns fallback when cookieHeader is empty', () => {
    expect(getLanguageFromCookieHeader('', 'en')).toBe('en');
  });

  it('extracts language from cookie header', () => {
    expect(getLanguageFromCookieHeader(`${DOD_PREFERRED_LANGUAGE_COOKIE}=en`, 'tr')).toBe('en');
    expect(
      getLanguageFromCookieHeader(`other=val; ${DOD_PREFERRED_LANGUAGE_COOKIE}=de; more=val`, 'tr'),
    ).toBe('de');
  });

  it('handles percent-encoded language values', () => {
    expect(
      getLanguageFromCookieHeader(`${DOD_PREFERRED_LANGUAGE_COOKIE}=%69%74`, 'tr'),
    ).toBe('it');
  });

  it('falls back to raw value when percent-encoding is malformed', () => {
    expect(
      getLanguageFromCookieHeader(`${DOD_PREFERRED_LANGUAGE_COOKIE}=%zz`, 'tr'),
    ).toBe('tr');
  });

  it('returns fallback for unknown languages', () => {
    expect(getLanguageFromCookieHeader(`${DOD_PREFERRED_LANGUAGE_COOKIE}=fr`, 'tr')).toBe('tr');
  });

  it('handles long input strings efficiently (ReDoS guard)', () => {
    const longString = `a${' '.repeat(50000)}b`;
    const header = `${DOD_PREFERRED_LANGUAGE_COOKIE}=${longString}`;

    const start = performance.now();
    const result = getLanguageFromCookieHeader(header, 'tr');
    const elapsed = performance.now() - start;

    expect(result).toBe('tr');
    expect(elapsed).toBeLessThan(100);
  });
});
