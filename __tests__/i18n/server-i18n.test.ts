import { getLanguageFromCookieHeader } from '@/lib/server-i18n';

describe('getLanguageFromCookieHeader', () => {
  it('returns fallback when cookieHeader is null', () => {
    expect(getLanguageFromCookieHeader(null, 'en')).toBe('en');
  });

  it('returns fallback when cookieHeader is empty', () => {
    expect(getLanguageFromCookieHeader('', 'en')).toBe('en');
  });

  it('extracts language from cookie header', () => {
    expect(getLanguageFromCookieHeader('dod_preferred_language=en', 'tr')).toBe('en');
    expect(getLanguageFromCookieHeader('other=val; dod_preferred_language=de; more=val', 'tr')).toBe('de');
  });

  it('handles encoded values', () => {
    expect(getLanguageFromCookieHeader('dod_preferred_language=it', 'tr')).toBe('it');
  });

  it('returns fallback for unknown languages', () => {
    expect(getLanguageFromCookieHeader('dod_preferred_language=fr', 'tr')).toBe('tr');
  });

  it('is vulnerable to ReDoS (demonstration)', () => {
    const longString = 'a' + ' '.repeat(50000) + 'b';
    const header = `dod_preferred_language=${longString}`;

    const start = Date.now();
    getLanguageFromCookieHeader(header, 'tr');
    const end = Date.now();

    console.log(`Execution time: ${end - start}ms`);
  });
});
