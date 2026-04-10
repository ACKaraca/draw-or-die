'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { account } from '@/lib/appwrite';

async function applyReferralAfterVerification(): Promise<void> {
  try {
    const jwt = await account.createJWT();
    await fetch('/api/referral/apply', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt.jwt}` },
    });
  } catch {
    // Referral hatası doğrulama akışını engellemez
  }
}

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Email doğrulanıyor...');

  const userId = useMemo(() => searchParams.get('userId') || '', [searchParams]);
  const secret = useMemo(() => searchParams.get('secret') || '', [searchParams]);

  useEffect(() => {
    const verify = async () => {
      if (!userId || !secret) {
        setStatus('error');
        setMessage('Doğrulama bağlantısı eksik veya hatalı.');
        return;
      }

      try {
        await account.updateVerification(userId, secret);
        // Referral ödülü varsa uygula (arka planda, sonucu beklenmez)
        void applyReferralAfterVerification();
        setStatus('success');
        setMessage('Email doğrulandı. Ana sayfaya yönlendiriliyorsun...');
        setTimeout(() => router.push('/'), 1800);
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Email doğrulanamadı.');
      }
    };

    void verify();
  }, [router, secret, userId]);

  return (
    <div className="min-h-screen bg-[#080B14] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0F1A] p-8 text-center shadow-2xl">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-cyan-200">Appwrite Verification</p>
        <h1 className="mt-3 text-3xl font-display uppercase tracking-wide">Email Doğrulama</h1>
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-red-300' : status === 'success' ? 'text-emerald-300' : 'text-slate-300'}`}>
          {message}
        </p>
        {status === 'error' && (
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-mono uppercase tracking-wider text-white hover:bg-white/10"
          >
            Ana sayfaya dön
          </button>
        )}
      </div>
    </div>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="min-h-screen bg-[#080B14] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0F1A] p-8 text-center shadow-2xl">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-cyan-200">Appwrite Verification</p>
        <h1 className="mt-3 text-3xl font-display uppercase tracking-wide">Email Doğrulama</h1>
        <p className="mt-4 text-sm text-slate-300">Email doğrulanıyor...</p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}