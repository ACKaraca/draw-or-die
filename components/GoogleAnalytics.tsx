import Script from 'next/script';
import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent';

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

const GA_DESTINATION_IDS = resolveDestinationIds();
const GA_SCRIPT_ID = GA_DESTINATION_IDS.find((id) => id.startsWith('GT-')) ?? GA_DESTINATION_IDS[0] ?? '';

export function GoogleAnalytics() {
  if (!GA_SCRIPT_ID || GA_DESTINATION_IDS.length === 0) {
    return null;
  }

  const configCommands = GA_DESTINATION_IDS
    .map((id) => `window.gtag('config', '${id}', { send_page_view: false, anonymize_ip: true });`)
    .join('\n');

  return (
    <>
      <Script id="ga-consent-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
          var cookieConsentKey = '${COOKIE_CONSENT_STORAGE_KEY}';
          var readConsentFromCookie = function() {
            try {
              var source = document.cookie || '';
              if (!source) return null;
              var prefix = encodeURIComponent(cookieConsentKey) + '=';
              var parts = source.split(';');
              for (var i = 0; i < parts.length; i += 1) {
                var item = parts[i].trim();
                if (item.indexOf(prefix) !== 0) continue;
                var rawValue = item.slice(prefix.length);
                return decodeURIComponent(rawValue || '');
              }
            } catch (error) {
              return null;
            }
            return null;
          };
          window.gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            wait_for_update: 500
          });
          var persistedConsent = null;
          try {
            persistedConsent = window.localStorage.getItem(cookieConsentKey);
          } catch (error) {
            // Privacy modes may block localStorage.
          }
          if (persistedConsent !== 'accepted' && persistedConsent !== 'rejected') {
            persistedConsent = readConsentFromCookie();
          }
          if (persistedConsent === 'accepted' || persistedConsent === 'rejected') {
            var consentValue = persistedConsent === 'accepted' ? 'granted' : 'denied';
            window.gtag('consent', 'update', {
              analytics_storage: consentValue,
              ad_storage: consentValue,
              ad_user_data: consentValue,
              ad_personalization: consentValue
            });
            try {
              window.localStorage.setItem(cookieConsentKey, persistedConsent);
            } catch (error) {
              // No-op.
            }
          }
          window.gtag('js', new Date());
          ${configCommands}
        `}
      </Script>
      <Script
        id="ga-library"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_SCRIPT_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
