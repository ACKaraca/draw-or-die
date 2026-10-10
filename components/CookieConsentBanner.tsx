'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import type { CookieConsentStatus } from '@/lib/cookie-consent';
import {
  applyAnalyticsConsent,
  captureUTMFromCurrentUrl,
  getCookieConsentStatus,
  trackConversionEvent,
  trackPageView,
} from '@/lib/growth-tracking';

type CookieConsentBannerProps = {
  initialConsentStatus?: CookieConsentStatus;
};

// Published on <html> so toasts and page padding can sit above the banner instead of under it.
const BANNER_HEIGHT_CSS_VAR = '--cookie-banner-h';

export function CookieConsentBanner({ initialConsentStatus }: CookieConsentBannerProps) {
  const language = useLanguage();
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(() => {
    const initialStatus = initialConsentStatus === 'unset'
      ? getCookieConsentStatus()
      : (initialConsentStatus ?? getCookieConsentStatus());
    return initialStatus === 'unset';
  });

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    const node = bannerRef.current;
    if (!visible || !node) {
      rootStyle.removeProperty(BANNER_HEIGHT_CSS_VAR);
      return;
    }

    const publishHeight = () => {
      rootStyle.setProperty(BANNER_HEIGHT_CSS_VAR, `${Math.ceil(node.getBoundingClientRect().height)}px`);
    };
    publishHeight();

    if (typeof ResizeObserver === 'undefined') {
      return () => rootStyle.removeProperty(BANNER_HEIGHT_CSS_VAR);
    }

    const observer = new ResizeObserver(publishHeight);
    observer.observe(node);
    return () => {
      observer.disconnect();
      rootStyle.removeProperty(BANNER_HEIGHT_CSS_VAR);
    };
  }, [visible]);

  if (!visible) return null;

  const dismiss = (nextStatus: Exclude<CookieConsentStatus, 'unset'>) => {
    setVisible(false);
    try {
      applyAnalyticsConsent(nextStatus);
    } catch {
      // Banner should still close even if analytics bridge fails.
    }
    if (nextStatus === 'accepted') {
      try {
        const utm = captureUTMFromCurrentUrl();
        void trackConversionEvent('cookie_consent_accepted', { source: 'banner' });
        if (Object.keys(utm).length > 0) {
          void trackConversionEvent('campaign_landing_view', { source: 'consent_accept' });
        }
        trackPageView(window.location.pathname);
      } catch {
        // No-op.
      }
    }
  };

  const closeLabel = pickLocalized(
    language,
    'Kapat (yalnızca zorunlu çerezler)',
    'Close (necessary cookies only)',
  );

  return (
    <div
      ref={bannerRef}
      role="region"
      aria-label={pickLocalized(language, 'Çerez tercihleri', 'Cookie preferences')}
      style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2147483647, pointerEvents: 'auto', isolation: 'isolate' }}
      className="pointer-events-auto isolate border-t border-white/15 bg-[#0a0f1a]/95 backdrop-blur px-4 py-4"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-slate-300 sm:max-w-3xl pr-2">
          {pickLocalized(
            language,
            'Site kullanımını ölçmek ve ürün kalitesini artırmak için Google Analytics çerezleri kullanıyoruz.',
            'We use Google Analytics cookies to measure site usage and improve product quality.',
          )}{' '}
          {pickLocalized(language, 'Detaylar için', 'For details')}{' '}
          <Link href="/legal/cookies" className="text-cyan-300 underline underline-offset-2">
            {pickLocalized(language, 'Çerez Politikası', 'Cookie policy')}
          </Link>
          .
        </p>

        <div className="pointer-events-auto flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => dismiss('rejected')}
            className="rounded-md border border-white/20 bg-white/5 px-4 py-2 text-xs font-mono uppercase tracking-wide text-slate-300 hover:bg-white/10 transition-colors"
          >
            {pickLocalized(language, 'Reddet', 'Reject')}
          </button>
          <button
            type="button"
            onClick={() => dismiss('accepted')}
            className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs font-mono uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/30 transition-colors"
          >
            {pickLocalized(language, 'Kabul Et', 'Accept')}
          </button>
          {/* Dismissing is not consent: closing keeps only strictly necessary cookies. */}
          <button
            type="button"
            onClick={() => dismiss('rejected')}
            aria-label={closeLabel}
            title={closeLabel}
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
