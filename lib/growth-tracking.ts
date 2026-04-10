'use client';

const UTM_STORAGE_KEY = 'draw_or_die_growth_utm_v1';
const COOKIE_CONSENT_STORAGE_KEY = 'draw_or_die_cookie_consent_v1';
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? 'G-53LBVDCHC6';
const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;

type UTMKey = (typeof UTM_KEYS)[number];
type UTMData = Partial<Record<UTMKey, string>> & {
  landing_path?: string;
  captured_at?: string;
};

export type CookieConsentStatus = 'accepted' | 'rejected' | 'unset';

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

function emitGtag(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
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
  const stored = readLocalStorage(COOKIE_CONSENT_STORAGE_KEY);
  if (stored === 'accepted' || stored === 'rejected') {
    return stored;
  }
  return 'unset';
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsentStatus() === 'accepted';
}

export function applyAnalyticsConsent(status: Exclude<CookieConsentStatus, 'unset'>): void {
  writeLocalStorage(COOKIE_CONSENT_STORAGE_KEY, status);
  const granted = status === 'accepted';

  emitGtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

export function trackPageView(pathname: string): void {
  if (typeof window === 'undefined') return;
  if (!GA_MEASUREMENT_ID || !hasAnalyticsConsent()) return;

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

  if (GA_MEASUREMENT_ID) {
    emitGtag('event', eventName, sanitizeAnalyticsParams(metadata));
  }
}
