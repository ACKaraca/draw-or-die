const MEASUREMENT_ID_PATTERN = /^[A-Za-z0-9-]{2,32}$/;

export const GOOGLE_TAG_LIBRARY_URL = 'https://www.googletagmanager.com/gtag/js';
export const GOOGLE_TAG_LIBRARY_ELEMENT_ID = 'ga-library';

export function sanitizeMeasurementIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter((id) => MEASUREMENT_ID_PATTERN.test(id))));
}

/**
 * Inline bootstrap for Google tag. Nothing is requested from Google until the visitor has
 * accepted analytics: the gtag library is injected only when consent is already persisted as
 * `accepted`, or later when a `consent update` grants `analytics_storage` (banner Accept).
 * Commands issued before that stay in the local dataLayer and never leave the browser on
 * reject / close.
 */
export function buildAnalyticsBootstrapScript(input: {
  consentStorageKey: string;
  destinationIds: readonly string[];
}): string {
  const destinationIds = sanitizeMeasurementIds(input.destinationIds);
  const libraryId = destinationIds.find((id) => id.startsWith('GT-')) ?? destinationIds[0] ?? '';
  if (!libraryId) return '';

  const libraryUrl = `${GOOGLE_TAG_LIBRARY_URL}?id=${encodeURIComponent(libraryId)}`;
  const configCommands = destinationIds
    .map((id) => `window.gtag('config', ${JSON.stringify(id)}, { send_page_view: false, anonymize_ip: true });`)
    .join('\n');

  return `
(function () {
  var consentKey = ${JSON.stringify(input.consentStorageKey)};
  var libraryUrl = ${JSON.stringify(libraryUrl)};
  var libraryElementId = ${JSON.stringify(GOOGLE_TAG_LIBRARY_ELEMENT_ID)};
  var libraryRequested = false;
  window.dataLayer = window.dataLayer || [];
  var loadLibrary = function () {
    if (libraryRequested || document.getElementById(libraryElementId)) return;
    libraryRequested = true;
    var script = document.createElement('script');
    script.id = libraryElementId;
    script.async = true;
    script.src = libraryUrl;
    document.head.appendChild(script);
  };
  window.gtag = function () {
    window.dataLayer.push(arguments);
    var update = arguments[2];
    if (arguments[0] === 'consent' && arguments[1] === 'update' && update && update.analytics_storage === 'granted') {
      loadLibrary();
    }
  };
  var readConsentCookie = function () {
    try {
      var prefix = encodeURIComponent(consentKey) + '=';
      var parts = (document.cookie || '').split(';');
      for (var i = 0; i < parts.length; i += 1) {
        var item = parts[i].trim();
        if (item.indexOf(prefix) === 0) return decodeURIComponent(item.slice(prefix.length) || '');
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
  var persisted = readConsentCookie();
  if (persisted !== 'accepted' && persisted !== 'rejected') {
    try {
      persisted = window.localStorage.getItem(consentKey);
    } catch (error) {
      persisted = null;
    }
  }
  window.gtag('js', new Date());
  ${configCommands}
  if (persisted === 'accepted' || persisted === 'rejected') {
    var value = persisted === 'accepted' ? 'granted' : 'denied';
    window.gtag('consent', 'update', {
      analytics_storage: value,
      ad_storage: value,
      ad_user_data: value,
      ad_personalization: value
    });
  }
})();
`;
}
