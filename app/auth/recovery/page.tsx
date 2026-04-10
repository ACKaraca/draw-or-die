'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { account } from '@/lib/appwrite';

function RecoveryContent() {
  const router = useRouter();
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
      setError('Kurtarma bağlantısı eksik veya hatalı.');
      return;
    }

    if (!password || password.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalı.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      await account.updateRecovery(userId, secret, password);
      setMessage('Şifre güncellendi. Giriş sayfasına yönlendiriliyorsun...');
      setTimeout(() => router.push('/'), 1800);
    } catch (recoveryError) {
      setError(recoveryError instanceof Error ? recoveryError.message : 'Şifre güncellenemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B14] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0F1A] p-8 shadow-2xl">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-amber-200 text-center">Appwrite Recovery</p>
        <h1 className="mt-3 text-3xl font-display uppercase tracking-wide text-center">Şifre Sıfırlama</h1>
        {email && <p className="mt-2 text-center text-sm text-slate-400">{email}</p>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Yeni Şifre</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
              placeholder="Yeni şifre"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Yeni Şifre Tekrar</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
              placeholder="Yeni şifre tekrar"
            />
          </div>

          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
          {message && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-mono uppercase tracking-wider text-amber-100 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
          </button>
        </form>
      </div>
    </div>
  );
}

function RecoveryFallback() {
  return (
    <div className="min-h-screen bg-[#080B14] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0A0F1A] p-8 shadow-2xl">
        <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-amber-200 text-center">Appwrite Recovery</p>
        <h1 className="mt-3 text-3xl font-display uppercase tracking-wide text-center">Şifre Sıfırlama</h1>
        <p className="mt-4 text-center text-sm text-slate-300">Bağlantı doğrulanıyor...</p>
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