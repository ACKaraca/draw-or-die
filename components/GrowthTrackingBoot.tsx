'use client';

import { useEffect } from 'react';
import {
  captureUTMFromCurrentUrl,
  syncAnalyticsConsentFromStorage,
  trackPageView,
  trackConversionEvent,
} from '@/lib/growth-tracking';

export function GrowthTrackingBoot() {
  useEffect(() => {
    syncAnalyticsConsentFromStorage();
    trackPageView(window.location.pathname);

    const utm = captureUTMFromCurrentUrl();
    if (Object.keys(utm).length > 0) {
      void trackConversionEvent('campaign_landing_view');
    }
  }, []);

  return null;
}
