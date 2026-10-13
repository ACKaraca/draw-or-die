'use client';

import { useEffect } from 'react';
import {
  captureUTMFromCurrentUrl,
  hasAnalyticsConsent,
  syncAnalyticsConsentFromStorage,
  trackPageView,
  trackConversionEvent,
} from '@/lib/growth-tracking';

export function GrowthTrackingBoot() {
  useEffect(() => {
    syncAnalyticsConsentFromStorage();
    // Campaign (UTM) attribution is non-essential: nothing is persisted until analytics consent exists.
    // The banner captures UTM itself on Accept.
    if (!hasAnalyticsConsent()) return;

    trackPageView(window.location.pathname);
    const utm = captureUTMFromCurrentUrl();
    if (Object.keys(utm).length > 0) {
      void trackConversionEvent('campaign_landing_view');
    }
  }, []);

  return null;
}
