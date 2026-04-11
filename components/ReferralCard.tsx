'use client';

import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/hooks/useAuth';

const REFERRAL_BASE_URL = (process.env.NEXT_PUBLIC_REFERRAL_BASE_URL ?? 'https://drawordie.app').replace(/\/$/, '');

export function ReferralCard() {
  const language = useLanguage();
  const { profile, refreshProfile } = useAuth();
  const [copied, setCopied] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualMessage, setManualMessage] = useState<string | null>(null);

  const referralCode = profile?.referral_code ?? null;
  const referredBy = typeof profile?.referred_by === 'string' && profile.referred_by.trim()
    ? profile.referred_by.trim().toUpperCase()
    : null;
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

  const handleManualReferralApply = async () => {
    if (manualLoading || referredBy) return;

    const normalized = manualCode.trim().toUpperCase();
    if (!normalized) {
      setManualError('Referral kodu girin.');
      setManualMessage(null);
      return;
    }

    setManualLoading(true);
    setManualError(null);
    setManualMessage(null);

    try {
      const jwt = await account.createJWT();
      const authHeader = { Authorization: `Bearer ${jwt.jwt}` };

      const linkResponse = await fetch('/api/referral/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        body: JSON.stringify({ referral_code: normalized }),
      });

      const linkPayload = await linkResponse.json().catch(() => ({})) as { error?: string };
      if (!linkResponse.ok) {
        throw new Error(linkPayload.error || 'Referral kodu kaydedilemedi.');
      }

      const applyResponse = await fetch('/api/referral/apply', {
        method: 'POST',
        headers: authHeader,
      });
      const applyPayload = await applyResponse.json().catch(() => ({})) as { error?: string; rewarded?: boolean };
      if (!applyResponse.ok) {
        throw new Error(applyPayload.error || 'Referral ödülü uygulanamadı.');
      }

      setManualCode('');
      setManualMessage(applyPayload.rewarded ? 'Referral kodu uygulandı. +5 Rapido eklendi.' : 'Referral kodu kaydedildi.');
      await refreshProfile();
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Referral kodu uygulanamadı.');
    } finally {
      setManualLoading(false);
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
        <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-200">{pickLocalized(language, 'Toplam referral kaydı', 'Total referral signups')}</p>
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
          {copied ? pickLocalized(language, 'Kopyalandı', 'Copied') : pickLocalized(language, 'Kopyala', 'Copy')}
        </button>
      </div>

      <p className="mt-3 text-[11px] font-mono text-slate-500 uppercase tracking-wider">
        Referral kodun: <span className="text-slate-300">{referralCode}</span>
      </p>

      <div className="mt-5 border-t border-emerald-500/15 pt-4">
        {referredBy ? (
          <div className="rounded-lg border border-emerald-500/20 bg-black/20 px-3 py-2.5">
            <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-200">Girilen referral kodu</p>
            <p className="mt-1 text-sm font-mono text-white">{referredBy}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400">Referral kodunu manuel girerek bir kez ödül alabilirsin.</p>
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value.toUpperCase().replace(/\s+/g, '').slice(0, 16))}
                placeholder="ABCD1234"
                className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-mono uppercase tracking-wider text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400"
                disabled={manualLoading}
              />
              <button
                type="button"
                onClick={() => void handleManualReferralApply()}
                disabled={manualLoading}
                className="inline-flex items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-emerald-100 text-xs font-mono uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {manualLoading ? 'Uygulanıyor...' : 'Kodu Uygula'}
              </button>
            </div>
            {manualError && <p className="mt-2 text-sm text-red-300">{manualError}</p>}
            {manualMessage && <p className="mt-2 text-sm text-emerald-200">{manualMessage}</p>}
          </>
        )}
      </div>
    </div>
  );
}
