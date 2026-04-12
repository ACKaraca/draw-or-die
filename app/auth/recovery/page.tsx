'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { account } from '@/lib/appwrite';

function RecoveryContent() {
  const router = useRouter();
  const language = useLanguage();
  const searchParams = useSearchParams();
  const userId = useMemo(() => searchParams.get('userId') || '', [searchParams]);
  const secret = useMemo(() => searchParams.get('secret') || '', [searchParams]);
  const email = useMemo(() => searchParams.get('email') || '', [searchParams]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!userId || !secret) {
      setError(pickLocalized(language, 'Kurtarma bağlantısı eksik veya hatalı.', 'The recovery link is missing or invalid.'));
      return;
    }

    if (!password || password.length < 8) {
      setError(pickLocalized(language, 'Yeni şifre en az 8 karakter olmalı.', 'The new password must be at least 8 characters long.'));
      return;
    }

    if (password !== confirmPassword) {
      setError(pickLocalized(language, 'Şifreler eşleşmiyor.', 'The passwords do not match.'));
      return;
    }

    setLoading(true);
    try {
      await account.updateRecovery(userId, secret, password);
      setMessage(pickLocalized(language, 'Şifre güncellendi. Giriş sayfasına yönlendiriliyorsun...', 'Password updated. Redirecting to the sign-in page...'));
      setTimeout(() => router.push('/'), 1800);
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : pickLocalized(language, 'Şifre güncellenemedi.', 'Password could not be updated.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B14] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0F1A] p-8 shadow-2xl">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-amber-200 text-center">Appwrite Recovery</p>
        <h1 className="mt-3 text-3xl font-display uppercase tracking-wide text-center">{pickLocalized(language, 'Şifre Sıfırlama', 'Password Reset')}</h1>
        {email && <p className="mt-2 text-center text-sm text-slate-400">{email}</p>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">{pickLocalized(language, 'Yeni Şifre', 'New Password')}</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
              placeholder={pickLocalized(language, 'Yeni şifre', 'New password')}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">{pickLocalized(language, 'Yeni Şifre Tekrar', 'New Password Again')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
              placeholder={pickLocalized(language, 'Yeni şifre tekrar', 'Repeat new password')}
            />
          </div>

          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
          {message && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-mono uppercase tracking-wider text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {loading ? pickLocalized(language, 'Kaydediliyor...', 'Saving...') : pickLocalized(language, 'Şifreyi Güncelle', 'Update password')}
          </button>
        </form>
      </div>
    </div>
  );
}

function RecoveryFallback() {
  const language = useLanguage();

  return (
    <div className="min-h-screen bg-[#080B14] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0F1A] p-8 shadow-2xl">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-amber-200 text-center">Appwrite Recovery</p>
        <h1 className="mt-3 text-3xl font-display uppercase tracking-wide text-center">{pickLocalized(language, 'Şifre Sıfırlama', 'Password Reset')}</h1>
        <p className="mt-4 text-center text-sm text-slate-300">{pickLocalized(language, 'Bağlantı doğrulanıyor...', 'Verifying link...')}</p>
      </div>
    </div>
  );
}

export default function RecoveryPage() {
  return (
    <Suspense fallback={<RecoveryFallback />}>
      <RecoveryContent />
    </Suspense>
  );
}