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

  it('renders banner when consent is unset', async () => {
    render(<CookieConsentBanner />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^kabul et$/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /^reddet$/i })).toBeInTheDocument();
  });

  it('does not render when consent is already accepted', async () => {
    mockedGetCookieConsentStatus.mockReturnValue('accepted');
    render(<CookieConsentBanner />);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^kabul et$/i })).not.toBeInTheDocument();
    });
  });

  it('accept flow updates consent and hides banner', async () => {
    render(<CookieConsentBanner />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^kabul et$/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /^kabul et$/i }));

    expect(mockedApplyAnalyticsConsent).toHaveBeenCalledWith('accepted');
    expect(mockedTrackConversionEvent).toHaveBeenCalledWith('cookie_consent_accepted', { source: 'banner' });
    expect(mockedTrackPageView).toHaveBeenCalledWith('/');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^kabul et$/i })).not.toBeInTheDocument();
    });
  });

  it('reject flow updates consent and hides banner', async () => {
    render(<CookieConsentBanner />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^reddet$/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /^reddet$/i }));

    expect(mockedApplyAnalyticsConsent).toHaveBeenCalledWith('rejected');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^reddet$/i })).not.toBeInTheDocument();
    });
  });

  it('close button accepts consent and hides banner', async () => {
    render(<CookieConsentBanner />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /kapat/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /kapat/i }));

    expect(mockedApplyAnalyticsConsent).toHaveBeenCalledWith('accepted');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /kapat/i })).not.toBeInTheDocument();
    });
  });

  it('still hides the banner when analytics bridge throws', async () => {
    mockedApplyAnalyticsConsent.mockImplementationOnce(() => {
      throw new Error('bridge-failed');
    });

    render(<CookieConsentBanner />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^kabul et$/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /^kabul et$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^kabul et$/i })).not.toBeInTheDocument();
    });
  });
});
