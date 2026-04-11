import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import {
  applyAnalyticsConsent,
  captureUTMFromCurrentUrl,
  getCookieConsentStatus,
  trackConversionEvent,
  trackPageView,
} from '@/lib/growth-tracking';

jest.mock('@/lib/growth-tracking', () => ({
  applyAnalyticsConsent: jest.fn(),
  captureUTMFromCurrentUrl: jest.fn(() => ({})),
  getCookieConsentStatus: jest.fn(() => 'unset'),
  trackConversionEvent: jest.fn(() => Promise.resolve()),
  trackPageView: jest.fn(),
}));

const mockedApplyAnalyticsConsent = jest.mocked(applyAnalyticsConsent);
const mockedCaptureUTMFromCurrentUrl = jest.mocked(captureUTMFromCurrentUrl);
const mockedGetCookieConsentStatus = jest.mocked(getCookieConsentStatus);
const mockedTrackConversionEvent = jest.mocked(trackConversionEvent);
const mockedTrackPageView = jest.mocked(trackPageView);

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCookieConsentStatus.mockReturnValue('unset');
    mockedCaptureUTMFromCurrentUrl.mockReturnValue({});
  });

  it('accept flow updates consent and hides banner', async () => {
    render(<CookieConsentBanner />);

    await userEvent.click(screen.getByRole('button', { name: /^kabul et$/i }));

    expect(mockedApplyAnalyticsConsent).toHaveBeenCalledWith('accepted');
    expect(mockedTrackConversionEvent).toHaveBeenCalledWith('cookie_consent_accepted', { source: 'banner' });
    expect(mockedTrackPageView).toHaveBeenCalledWith('/');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^kabul et$/i })).not.toBeInTheDocument();
    });
  });

  it('close button also accepts consent and hides banner', async () => {
    render(<CookieConsentBanner />);

    await userEvent.click(screen.getByRole('button', { name: /kapat ve kabul et/i }));

    expect(mockedApplyAnalyticsConsent).toHaveBeenCalledWith('accepted');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /kapat ve kabul et/i })).not.toBeInTheDocument();
    });
  });

  it('still hides the banner when analytics bridge throws', async () => {
    mockedApplyAnalyticsConsent.mockImplementationOnce(() => {
      throw new Error('bridge-failed');
    });

    render(<CookieConsentBanner />);

    await userEvent.click(screen.getByRole('button', { name: /^kabul et$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^kabul et$/i })).not.toBeInTheDocument();
    });
  });
});
