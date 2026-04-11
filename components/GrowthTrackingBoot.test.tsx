import { render } from '@testing-library/react';
import { GrowthTrackingBoot } from '@/components/GrowthTrackingBoot';
import { captureUTMFromCurrentUrl, syncAnalyticsConsentFromStorage, trackConversionEvent, trackPageView } from '@/lib/growth-tracking';

jest.mock('@/lib/growth-tracking', () => ({
  captureUTMFromCurrentUrl: jest.fn(),
  syncAnalyticsConsentFromStorage: jest.fn(),
  trackConversionEvent: jest.fn(),
  trackPageView: jest.fn(),
}));

const mockedCapture = jest.mocked(captureUTMFromCurrentUrl);
const mockedSyncConsent = jest.mocked(syncAnalyticsConsentFromStorage);
const mockedTrack = jest.mocked(trackConversionEvent);
const mockedTrackPageView = jest.mocked(trackPageView);

describe('GrowthTrackingBoot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tracks initial page view on mount', () => {
    mockedCapture.mockReturnValue({});

    render(<GrowthTrackingBoot />);

    expect(mockedSyncConsent).toHaveBeenCalledTimes(1);
    expect(mockedTrackPageView).toHaveBeenCalledWith('/');
  });

  it('emits a landing view event when utm parameters exist', () => {
    mockedCapture.mockReturnValue({ utm_source: 'newsletter' });

    render(<GrowthTrackingBoot />);

    expect(mockedTrack).toHaveBeenCalledWith('campaign_landing_view');
  });

  it('does nothing when the current url has no utm parameters', () => {
    mockedCapture.mockReturnValue({});

    render(<GrowthTrackingBoot />);

    expect(mockedTrack).not.toHaveBeenCalled();
  });
});
