import { headers } from 'next/headers';
import Script from 'next/script';

import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';
import { buildAnalyticsBootstrapScript } from '@/lib/privacy/analytics-bootstrap';
import { isProductionRequestHeaders, resolveAnalyticsDestinationIds } from '@/lib/site-identity';

// Resolved per request so dev/preview hosts never load or write to the production property.
// The gtag library itself is injected by the bootstrap only after analytics consent is granted.
export async function GoogleAnalytics(): Promise<React.JSX.Element | null> {
  const destinationIds = resolveAnalyticsDestinationIds(isProductionRequestHeaders(await headers()));
  const bootstrapScript = buildAnalyticsBootstrapScript({
    consentStorageKey: COOKIE_CONSENT_STORAGE_KEY,
    destinationIds,
  });

  if (!bootstrapScript) {
    return null;
  }

  return (
    <Script id="ga-consent-default" strategy="afterInteractive">
      {bootstrapScript}
    </Script>
  );
}
