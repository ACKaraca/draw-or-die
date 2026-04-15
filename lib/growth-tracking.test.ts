import {
  applyAnalyticsConsent,
  getCookieConsentStatus,
  syncAnalyticsConsentFromStorage,
} from '@/lib/growth-tracking';
import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';

describe('growth-tracking consent persistence', () => {
  const storagePrototype = Object.getPrototypeOf(window.localStorage) as Storage;

  beforeEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
    document.cookie = `${COOKIE_CONSENT_STORAGE_KEY}=; Max-Age=0; Path=/`;
    (window as Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] }).gtag = undefined;
    (window as Window & { dataLayer?: unknown[] }).dataLayer = [];
  });

  it('reads consent from cookie when localStorage is unavailable', () => {
    jest.spyOn(storagePrototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    document.cookie = `${COOKIE_CONSENT_STORAGE_KEY}=accepted; Path=/`;

    expect(getCookieConsentStatus()).toBe('accepted');
  });

  it('writes consent cookie even if localStorage write fails', () => {
    jest.spyOn(storagePrototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    applyAnalyticsConsent('rejected');

    expect(document.cookie).toContain(`${COOKIE_CONSENT_STORAGE_KEY}=rejected`);
  });

  it('re-syncs analytics consent from persisted storage on boot', () => {
    document.cookie = `${COOKIE_CONSENT_STORAGE_KEY}=accepted; Path=/`;
    const gtag = jest.fn();
    (window as Window & { gtag?: (...args: unknown[]) => void }).gtag = gtag;

    syncAnalyticsConsentFromStorage();

    expect(gtag).toHaveBeenCalledWith('consent', 'update', expect.objectContaining({
      analytics_storage: 'granted',
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
    }));
  });
});
