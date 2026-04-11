'use client';

import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const REFERRAL_BASE_URL = (process.env.NEXT_PUBLIC_REFERRAL_BASE_URL ?? 'https://drawordie.app').replace(/\/$/, '');

export function ReferralCard() {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);

  const referralCode = profile?.referral_code ?? null;
  const referralSignupCount = Number.isFinite(profile?.referral_signup_count)
    ? Math.max(0, Math.trunc(profile?.referral_signup_count ?? 0))
    : 0;

  if (!referralCode) return null;

  const referralLink = `${REFERRAL_BASE_URL}/?ref=${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API başarısız olursa fallback
      const el = document.createElement('textarea');
      el.value = referralLink;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div className="flex items-center gap-2 border-b border-emerald-500/15 pb-3 mb-4">
        <Share2 size={16} className="text-emerald-400" />
        <h3 className="font-mono text-sm uppercase tracking-widest text-emerald-300">
          Arkadaşını Davet Et
        </h3>
      </div>

      <p className="text-sm text-slate-300 mb-1">
        Referral linkini paylaş. Arkadaşın hesabını doğruladıktan sonra <span className="text-emerald-300 font-bold">ikiniz de 5 Rapido</span> kazanırsınız.
      </p>
      <p className="text-xs text-slate-500 mb-4">
        Ödül, email doğrulaması tamamlandıktan sonra otomatik olarak eklenir.
      </p>

      <div className="mb-4 rounded-lg border border-emerald-500/20 bg-black/20 px-3 py-2.5">
        <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-200">Toplam referral kaydı</p>
        <p className="mt-1 text-xl font-display text-white">{referralSignupCount}</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs text-slate-300 truncate select-all">
          {referralLink}
        </div>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-emerald-200 text-xs font-mono uppercase tracking-wider hover:bg-emerald-500/20 transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>

      <p className="mt-3 text-[11px] font-mono text-slate-500 uppercase tracking-wider">
        Referral kodun: <span className="text-slate-300">{referralCode}</span>
      </p>
    </div>
  );
}
