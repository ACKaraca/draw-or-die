import {
  applyAnalyticsConsent,
  captureUTMFromCurrentUrl,
  getPersistedUTM,
  trackConversionEvent,
} from '@/lib/growth-tracking';

describe('growth tracking helpers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    window.history.pushState({}, '', '/landing?utm_source=newsletter&utm_medium=email&utm_campaign=spring');
    window.localStorage.clear();
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-03-19T00:00:00.000Z');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
    window.history.pushState({}, '', '/');
  });

  it('captures and persists UTM parameters from the current url', () => {
    const utm = captureUTMFromCurrentUrl();

    expect(utm).toEqual({
      utm_source: 'newsletter',
      utm_medium: 'email',
      utm_campaign: 'spring',
      landing_path: '/landing',
      captured_at: '2026-03-19T00:00:00.000Z',
    });
    expect(getPersistedUTM()).toEqual(utm);
  });

  it('falls back to persisted UTM data when no query params exist', () => {
    window.history.replaceState({}, '', '/landing');
    window.localStorage.setItem(
      'draw_or_die_growth_utm_v1',
      JSON.stringify({ utm_source: 'referral', landing_path: '/landing' })
    );

    expect(captureUTMFromCurrentUrl()).toEqual({
      utm_source: 'referral',
      landing_path: '/landing',
    });
  });

  it('sends a conversion event with persisted context', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response) as never;
    window.localStorage.setItem(
      'draw_or_die_growth_utm_v1',
      JSON.stringify({ utm_source: 'newsletter', landing_path: '/landing' })
    );
    applyAnalyticsConsent('accepted');

    await trackConversionEvent('campaign_landing_view', { source: 'hero' });

    expect(global.fetch).toHaveBeenCalledWith('/api/growth/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"eventName":"campaign_landing_view"'),
      keepalive: true,
    });
  });

  it('does not send conversion events when consent is not granted', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response) as never;

    await trackConversionEvent('campaign_landing_view', { source: 'hero' });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
