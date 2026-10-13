'use client';

import {
  COOKIE_CONSENT_STORAGE_KEY,
  normalizeCookieConsentStatus,
  readCookieValueFromDocument,
  type CookieConsentStatus,
} from '@/lib/cookie-consent';
import { normalizeHost, PRODUCTION_HOST, resolveAnalyticsDestinationIds } from '@/lib/site-identity';

const UTM_STORAGE_KEY = 'draw_or_die_growth_utm_v1';
const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

/**
 * Client mirror of the server-side resolution in GoogleAnalytics: only the production host may send to the
 * production GA destinations; any other host only gets NEXT_PUBLIC_GA_NON_PRODUCTION_IDS.
 */
export function resolveClientAnalyticsDestinationIds(
  hostname: string | null | undefined = typeof window === 'undefined' ? null : window.location.hostname,
): string[] {
  if (!hostname) return [];
  const isProduction = normalizeHost(hostname) === PRODUCTION_HOST;
  // Next only inlines literal process.env.NEXT_PUBLIC_* reads in client bundles, so the env is spelled out.
  return resolveAnalyticsDestinationIds(isProduction, {
    NEXT_PUBLIC_GOOGLE_TAG_ID: process.env.NEXT_PUBLIC_GOOGLE_TAG_ID,
    NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    NEXT_PUBLIC_GA_SECONDARY_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_SECONDARY_MEASUREMENT_ID,
    NEXT_PUBLIC_GA_DESTINATION_IDS: process.env.NEXT_PUBLIC_GA_DESTINATION_IDS,
    NEXT_PUBLIC_GA_NON_PRODUCTION_IDS: process.env.NEXT_PUBLIC_GA_NON_PRODUCTION_IDS,
  });
}

type UTMKey = (typeof UTM_KEYS)[number];
type UTMData = Partial<Record<UTMKey, string>> & {
  landing_path?: string;
  captured_at?: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore quota/privacy mode failures.
  }
}

function writeCookieConsent(status: Exclude<CookieConsentStatus, 'unset'>): void {
  if (typeof document === 'undefined') return;

  try {
    const key = encodeURIComponent(COOKIE_CONSENT_STORAGE_KEY);
    const value = encodeURIComponent(status);
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    document.cookie = `${key}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${isSecure ? '; Secure' : ''}`;
  } catch {
    // Ignore browser cookie write failures.
  }
}

function readCookieConsentStatus(): CookieConsentStatus {
  const cookieValue = readCookieValueFromDocument(COOKIE_CONSENT_STORAGE_KEY);
  return normalizeCookieConsentStatus(cookieValue);
}

function emitGtag(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer ?? [];
  if (typeof window.gtag !== 'function') {
    window.gtag = (...queueArgs: unknown[]) => {
      window.dataLayer?.push(queueArgs);
    };
  }

  if (typeof window.gtag === 'function') {
    window.gtag(...args);
  }
}

function sanitizeAnalyticsParams(
  metadata: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const normalized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      normalized[key] = value;
      continue;
    }

    if (value === null || value === undefined) continue;
    normalized[key] = String(value);
  }

  return normalized;
}

function getStoredUTM(): UTMData {
  const raw = readLocalStorage(UTM_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as UTMData;
  } catch {
    return {};
  }
}

export function captureUTMFromCurrentUrl(): UTMData {
  if (typeof window === 'undefined') {
    return {};
  }

  const searchParams = new URLSearchParams(window.location.search);
  const captured: UTMData = {};

  UTM_KEYS.forEach((key) => {
    const value = searchParams.get(key);
    if (value) {
      captured[key] = value;
    }
  });

  if (Object.keys(captured).length === 0) {
    return getStoredUTM();
  }

  const merged: UTMData = {
    ...getStoredUTM(),
    ...captured,
    landing_path: window.location.pathname,
    captured_at: new Date().toISOString(),
  };

  writeLocalStorage(UTM_STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export function getPersistedUTM(): UTMData {
  return getStoredUTM();
}

export function getCookieConsentStatus(): CookieConsentStatus {
  const fromCookie = readCookieConsentStatus();
  if (fromCookie !== 'unset') {
    return fromCookie;
  }

  const stored = readLocalStorage(COOKIE_CONSENT_STORAGE_KEY);
  return normalizeCookieConsentStatus(stored);
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsentStatus() === 'accepted';
}

export function applyAnalyticsConsent(status: Exclude<CookieConsentStatus, 'unset'>): void {
  writeCookieConsent(status);
  writeLocalStorage(COOKIE_CONSENT_STORAGE_KEY, status);
  const consentValue = status === 'accepted' ? 'granted' : 'denied';

  emitGtag('consent', 'update', {
    analytics_storage: consentValue,
    ad_storage: consentValue,
    ad_user_data: consentValue,
    ad_personalization: consentValue,
  });
}

export function syncAnalyticsConsentFromStorage(): void {
  const status = getCookieConsentStatus();
  if (status === 'accepted' || status === 'rejected') {
    applyAnalyticsConsent(status);
  }
}

export function trackPageView(pathname: string): void {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent() || resolveClientAnalyticsDestinationIds().length === 0) return;

  emitGtag('event', 'page_view', {
    page_path: pathname || window.location.pathname,
    page_location: window.location.href,
    page_title: document.title,
  });
}

export async function trackConversionEvent(
  eventName: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (!hasAnalyticsConsent()) {
    return;
  }

  const payload = {
    eventName,
    metadata,
    utm: getPersistedUTM(),
    page: window.location.pathname,
    referrer: document.referrer || null,
    occurredAt: new Date().toISOString(),
  };

  try {
    await fetch('/api/growth/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Do not break auth/conversion flows if analytics endpoint is unavailable.
  }

  if (resolveClientAnalyticsDestinationIds().length > 0) {
    emitGtag('event', eventName, sanitizeAnalyticsParams(metadata));
  }
}
