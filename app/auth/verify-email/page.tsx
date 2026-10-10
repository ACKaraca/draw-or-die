'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalizedFour } from '@/lib/i18n';
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

type VerifyStatus = 'loading' | 'success' | 'missing-link' | 'invalid-link' | 'failed';

function VerifyEmailContent() {
  const router = useRouter();
  const language = useLanguage();
  const searchParams = useSearchParams();
  // Store a status, not a message, so the copy follows the current UI language at render time.
  const [status, setStatus] = useState<VerifyStatus>('loading');

  const userId = useMemo(() => searchParams.get('userId') || '', [searchParams]);
  const secret = useMemo(() => searchParams.get('secret') || '', [searchParams]);

  useEffect(() => {
    const verify = async () => {
      if (!userId || !secret) {
        setStatus('missing-link');
        return;
      }

      try {
        await account.updateVerification(userId, secret);
        // Referral ödülü varsa uygula (arka planda, sonucu beklenmez)
        void applyReferralAfterVerification();
        setStatus('success');
        setTimeout(() => router.push('/'), 1800);
      } catch (error) {
        const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
        setStatus(code === 401 || code === 404 ? 'invalid-link' : 'failed');
      }
    };

    void verify();
  }, [router, secret, userId]);

  const isError = status === 'missing-link' || status === 'invalid-link' || status === 'failed';
  const message = (() => {
    switch (status) {
      case 'loading':
        return pickLocalizedFour(language, 'E-posta doğrulanıyor...', 'Verifying your email...', 'E-Mail wird überprüft...', 'Email in verifica...');
      case 'success':
        return pickLocalizedFour(language, 'E-posta doğrulandı. Ana sayfaya yönlendiriliyorsun...', 'Email verified. Redirecting to the home page...', 'E-Mail bestätigt. Du wirst zur Startseite weitergeleitet...', 'Email verificata. Verrai reindirizzato alla home...');
      case 'missing-link':
        return pickLocalizedFour(language, 'Doğrulama bağlantısı eksik veya hatalı. E-postadaki bağlantıyı eksiksiz açtığından emin ol.', 'The verification link is missing or incomplete. Make sure you open the full link from the email.', 'Der Verifizierungslink fehlt oder ist ungültig.', 'Il link di verifica è mancante o non valido.');
      case 'invalid-link':
        return pickLocalizedFour(language, 'Bu doğrulama bağlantısı geçersiz veya süresi dolmuş. Giriş yapıp yeni bir doğrulama e-postası iste.', 'This verification link is invalid or has expired. Sign in and request a new verification email.', '', '');
      case 'failed':
        return pickLocalizedFour(language, 'E-posta şu anda doğrulanamadı. Lütfen birkaç dakika sonra bağlantıyı tekrar aç.', 'Your email could not be verified right now. Please open the link again in a few minutes.', 'E-Mail konnte nicht bestätigt werden.', 'Impossibile verificare l’email.');
      default: {
        const _exhaustive: never = status;
        throw new Error(`Unhandled verify status: ${String(_exhaustive)}`);
      }
    }
  })();

  return (
    <div className="min-h-screen bg-[#080B14] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0F1A] p-8 text-center shadow-2xl">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-cyan-200">
          {pickLocalizedFour(language, 'Hesap Doğrulama', 'Account Verification', 'Kontobestätigung', 'Verifica account')}
        </p>
        <h1 className="mt-3 text-3xl font-display uppercase tracking-wide">{pickLocalizedFour(language, 'E-posta Doğrulama', 'Email Verification', 'E-Mail-Verifizierung', 'Verifica email')}</h1>
        <p
          role={isError ? 'alert' : 'status'}
          className={`mt-4 text-sm ${isError ? 'text-red-300' : status === 'success' ? 'text-emerald-300' : 'text-slate-300'}`}
        >
          {message}
        </p>
        {isError && (
          <button
            type="button"
            onClick={() => router.push('/')}
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-mono uppercase tracking-wider text-white hover:bg-white/10"
          >
            {pickLocalizedFour(language, 'Ana sayfaya dön', 'Back to home', 'Zur Startseite', 'Torna alla home')}
          </button>
        )}
      </div>
    </div>
  );
}

function VerifyEmailFallback() {
  const language = useLanguage();

  return (
    <div className="min-h-screen bg-[#080B14] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0F1A] p-8 text-center shadow-2xl">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-cyan-200">
          {pickLocalizedFour(language, 'Hesap Doğrulama', 'Account Verification', 'Kontobestätigung', 'Verifica account')}
        </p>
        <h1 className="mt-3 text-3xl font-display uppercase tracking-wide">{pickLocalizedFour(language, 'E-posta Doğrulama', 'Email Verification', 'E-Mail-Verifizierung', 'Verifica email')}</h1>
        <p className="mt-4 text-sm text-slate-300">{pickLocalizedFour(language, 'E-posta doğrulanıyor...', 'Verifying your email...', 'E-Mail wird überprüft...', 'Email in verifica...')}</p>
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