import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';
import {
  GOOGLE_TAG_LIBRARY_ELEMENT_ID,
  buildAnalyticsBootstrapScript,
  sanitizeMeasurementIds,
} from '@/lib/privacy/analytics-bootstrap';

const IDS = ['GT-TEST1', 'G-TEST2'];

function runBootstrap(): void {
  const script = buildAnalyticsBootstrapScript({ consentStorageKey: COOKIE_CONSENT_STORAGE_KEY, destinationIds: IDS });
  // Executes the generated inline script exactly as the browser would.
  new Function(script)();
}

function libraryScript(): HTMLScriptElement | null {
  return document.getElementById(GOOGLE_TAG_LIBRARY_ELEMENT_ID) as HTMLScriptElement | null;
}

function clearConsentCookie(): void {
  document.cookie = `${COOKIE_CONSENT_STORAGE_KEY}=; Path=/; Max-Age=0`;
}

describe('analytics bootstrap consent gating', () => {
  beforeEach(() => {
    clearConsentCookie();
    window.localStorage.clear();
    libraryScript()?.remove();
    delete window.gtag;
    delete window.dataLayer;
  });

  it('does not request the Google tag library while consent is unset', () => {
    runBootstrap();

    expect(libraryScript()).toBeNull();
    expect(window.dataLayer?.length).toBeGreaterThan(0);
  });

  it('does not request the library after reject / banner close', () => {
    document.cookie = `${COOKIE_CONSENT_STORAGE_KEY}=rejected; Path=/`;
    runBootstrap();
    window.gtag?.('consent', 'update', { analytics_storage: 'denied' });

    expect(libraryScript()).toBeNull();
  });

  it('loads the library immediately when consent was already accepted', () => {
    document.cookie = `${COOKIE_CONSENT_STORAGE_KEY}=accepted; Path=/`;
    runBootstrap();

    expect(libraryScript()?.src).toBe('https://www.googletagmanager.com/gtag/js?id=GT-TEST1');
  });

  it('loads the library once when consent is granted later from the banner', () => {
    runBootstrap();
    expect(libraryScript()).toBeNull();

    window.gtag?.('consent', 'update', { analytics_storage: 'granted' });
    window.gtag?.('consent', 'update', { analytics_storage: 'granted' });

    expect(document.querySelectorAll(`#${GOOGLE_TAG_LIBRARY_ELEMENT_ID}`)).toHaveLength(1);
  });

  it('drops measurement ids that could break out of the inline script', () => {
    expect(sanitizeMeasurementIds(['G-OK1', "G-1');alert(1)//", 'G-OK1'])).toEqual(['G-OK1']);
    expect(buildAnalyticsBootstrapScript({ consentStorageKey: 'k', destinationIds: ["');x//"] })).toBe('');
  });
});
