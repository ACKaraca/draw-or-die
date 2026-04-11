'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  applyAnalyticsConsent,
  captureUTMFromCurrentUrl,
  type CookieConsentStatus,
  getCookieConsentStatus,
  trackConversionEvent,
  trackPageView,
} from '@/lib/growth-tracking';

export function CookieConsentBanner() {
  const [status, setStatus] = useState<CookieConsentStatus>(() => {
    if (typeof window === 'undefined') return 'unset';
    return getCookieConsentStatus();
  });

  if (status !== 'unset') {
    return null;
  }

  const updateConsent = (nextStatus: Exclude<CookieConsentStatus, 'unset'>) => {
    setStatus(nextStatus);
    try {
      applyAnalyticsConsent(nextStatus);
    } catch {
      // Banner should still close even if analytics bridge fails.
    }
  };

  const accept = () => {
    updateConsent('accepted');
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
  };

  const reject = () => {
    updateConsent('rejected');
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[2147483647] pointer-events-auto border-t border-white/15 bg-[#0a0f1a]/95 backdrop-blur px-4 py-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-xs leading-relaxed text-slate-300 md:max-w-4xl">
          Site kullanimini olcmek ve urun kalitesini artirmak icin Google Analytics cerezleri kullaniyoruz.
          &quot;Kabul Et&quot; seçeneğinde Google Signals, User-ID/kullanıcı tarafından sağlanan veriler, ayrıntılı konum-cihaz ölçümü ve reklam kişiselleştirme dahil analiz özellikleri etkinleşir.
          &quot;Reddet&quot; seçeneğinde analitik ve reklam çerezleri kapalı kalır, sadece zorunlu teknik çerezler çalışır.
          Detaylar icin <Link href="/legal/cookies" className="text-cyan-300 underline underline-offset-2">Cerez Politikasi</Link>.
        </div>

        <div className="flex flex-shrink-0 gap-2">
          <button
            type="button"
            onClick={reject}
            className="pointer-events-auto touch-manipulation rounded-md border border-white/25 px-4 py-2 text-xs font-mono uppercase tracking-wide text-white hover:bg-white/10"
          >
            Reddet
          </button>
          <button
            type="button"
            onClick={accept}
            className="pointer-events-auto touch-manipulation rounded-md border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs font-mono uppercase tracking-wide text-emerald-100 hover:bg-emerald-500/30"
          >
            Kabul Et
          </button>
        </div>
      </div>
    </div>
  );
}
