'use client';

import { useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { account } from '@/lib/appwrite';

type EduVerificationCardProps = {
  eduVerified: boolean;
  verifiedEduEmail: string | null;
  pendingEduEmail: string | null;
  onVerified: () => Promise<void> | void;
  className?: string;
};

type VerifyEduStartResponse = {
  message?: string;
  error?: string;
  requiresManualEntry?: boolean;
  delivery?: 'email' | 'manual';
  devOtp?: string;
};

type VerifyEduConfirmResponse = {
  message?: string;
  error?: string;
  verified?: boolean;
};

export function EduVerificationCard({
  eduVerified,
  verifiedEduEmail,
  pendingEduEmail,
  onVerified,
  className,
}: EduVerificationCardProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loadingStart, setLoadingStart] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const pendingInfo = useMemo(() => {
    if (!pendingEduEmail) return null;
    return pendingEduEmail;
  }, [pendingEduEmail]);

  const startVerification = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError('Lutfen bir edu.tr email girin.');
      return;
    }

    setLoadingStart(true);
    setError(null);
    setMessage(null);
    setDevOtpHint(null);

    try {
      const jwt = await account.createJWT();
      const response = await fetch('/api/verify-edu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt.jwt}`,
        },
        body: JSON.stringify({ email: normalized }),
      });

      const payload = (await response.json().catch(() => ({}))) as VerifyEduStartResponse;
      if (!response.ok) {
        throw new Error(payload.error || 'Dogrulama baslatilamadi.');
      }

      setMessage(payload.message || 'Dogrulama kodu olusturuldu.');
      if (payload.devOtp) {
        setDevOtpHint(payload.devOtp);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Dogrulama baslatilamadi.');
    } finally {
      setLoadingStart(false);
    }
  };

  const confirmVerification = async () => {
    const normalizedCode = code.trim();
    if (!normalizedCode) {
      setError('Lutfen dogrulama kodunu girin.');
      return;
    }

    setLoadingConfirm(true);
    setError(null);
    setMessage(null);

    try {
      const jwt = await account.createJWT();
      const response = await fetch('/api/verify-edu', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt.jwt}`,
        },
        body: JSON.stringify({ code: normalizedCode }),
      });

      const payload = (await response.json().catch(() => ({}))) as VerifyEduConfirmResponse;
      if (!response.ok || !payload.verified) {
        throw new Error(payload.error || 'Kod dogrulanamadi.');
      }

      setMessage(payload.message || 'edu.tr email dogrulandi.');
      setCode('');
      setEmail('');
      setDevOtpHint(null);
      await onVerified();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Kod dogrulanamadi.');
    } finally {
      setLoadingConfirm(false);
    }
  };

  return (
    <div className={className || 'rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5'}>
      <div className="flex items-center gap-2 text-emerald-300">
        <GraduationCap size={16} />
        <h3 className="font-mono text-xs uppercase tracking-wider">Ogrenci Email Dogrulamasi</h3>
      </div>

      <p className="mt-3 text-sm text-slate-300">
        Normal hesabin farkli olsa bile ikinci bir edu.tr email tanimlayip ogrenci indirimini aktif edebilirsin.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
          <p className="text-[10px] font-mono uppercase text-slate-400">Dogrulama Durumu</p>
          <p className="mt-1">{eduVerified ? 'Onaylandi' : 'Onay bekliyor'}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
          <p className="text-[10px] font-mono uppercase text-slate-400">Onayli edu.tr Email</p>
          <p className="mt-1 break-all">{verifiedEduEmail || '-'}</p>
        </div>
      </div>

      {eduVerified && (
        <p className="mt-3 text-sm text-emerald-200">
          Ogrenci dogrulaman onaylandi. {verifiedEduEmail ? `Onayli email: ${verifiedEduEmail}` : ''}
        </p>
      )}

      {!eduVerified && (
        <>
          {pendingInfo && (
            <p className="mt-3 text-xs text-amber-300">
              Bekleyen email: {pendingInfo}
            </p>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ornek@universite.edu.tr"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={() => void startVerification()}
              disabled={loadingStart}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {loadingStart ? 'Gonderiliyor...' : 'Kod Gonder'}
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 haneli kod"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
            />
            <button
              type="button"
              onClick={() => void confirmVerification()}
              disabled={loadingConfirm}
              className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-xs font-mono uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {loadingConfirm ? 'Kontrol...' : 'Kodu Onayla'}
            </button>
          </div>
        </>
      )}

      {message && <p className="mt-3 text-xs text-emerald-200">{message}</p>}
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      {devOtpHint && <p className="mt-3 text-xs text-amber-300">Gelistirme modu kodu: {devOtpHint}</p>}
    </div>
  );
}
