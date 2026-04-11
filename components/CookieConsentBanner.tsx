'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  applyAnalyticsConsent,
  captureUTMFromCurrentUrl,
  type CookieConsentStatus,
  getCookieConsentStatus,
  trackConversionEvent,
  trackPageView,
} from '@/lib/growth-tracking';

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsentStatus() === 'unset');
  }, []);

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

  return (
    <div
      style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 2147483647 }}
      className="border-t border-white/15 bg-[#0a0f1a]/95 backdrop-blur px-4 py-4"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-slate-300 sm:max-w-3xl pr-2">
          Site kullanimini olcmek ve urun kalitesini artirmak icin Google Analytics cerezleri kullaniyoruz.
          Detaylar icin{' '}
          <Link href="/legal/cookies" className="text-cyan-300 underline underline-offset-2">
            Cerez Politikasi
          </Link>
          .
        </p>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => dismiss('rejected')}
            className="rounded-md border border-white/20 bg-white/5 px-4 py-2 text-xs font-mono uppercase tracking-wide text-slate-300 hover:bg-white/10 transition-colors"
          >
            Reddet
          </button>
          <button
            type="button"
            onClick={() => dismiss('accepted')}
            className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs font-mono uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/30 transition-colors"
          >
            Kabul Et
          </button>
          <button
            type="button"
            onClick={() => dismiss('accepted')}
            aria-label="Kapat ve kabul et"
            title="Kapat ve kabul et"
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
