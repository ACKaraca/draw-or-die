import Script from 'next/script';

import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';
import { buildAnalyticsBootstrapScript } from '@/lib/privacy/analytics-bootstrap';

const DEFAULT_GA_DESTINATION_IDS = ['GT-5TCMV7L2', 'G-1159TDRHXC', 'G-53LBVDCHC6'] as const;

function parseIds(rawValue?: string): string[] {
  if (!rawValue) {
    return [];
  }

  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function resolveDestinationIds(): string[] {
  const configured = Array.from(new Set([
    ...parseIds(process.env.NEXT_PUBLIC_GOOGLE_TAG_ID),
    ...parseIds(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    ...parseIds(process.env.NEXT_PUBLIC_GA_SECONDARY_MEASUREMENT_ID),
    ...parseIds(process.env.NEXT_PUBLIC_GA_DESTINATION_IDS),
  ]));

  if (configured.length > 0) {
    return configured;
  }

  return [...DEFAULT_GA_DESTINATION_IDS];
}

const GA_BOOTSTRAP_SCRIPT = buildAnalyticsBootstrapScript({
  consentStorageKey: COOKIE_CONSENT_STORAGE_KEY,
  destinationIds: resolveDestinationIds(),
});

// The gtag library itself is injected by the bootstrap only after analytics consent is granted.
export function GoogleAnalytics() {
  if (!GA_BOOTSTRAP_SCRIPT) {
    return null;
  }

  return (
    <Script id="ga-consent-default" strategy="afterInteractive">
      {GA_BOOTSTRAP_SCRIPT}
    </Script>
  );
}
