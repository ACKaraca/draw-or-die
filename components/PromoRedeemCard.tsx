'use client';

import { useState } from 'react';
import { BadgePercent, Loader2, Ticket } from 'lucide-react';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/hooks/useAuth';

export function PromoRedeemCard() {
  const { user, refreshProfile } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRedeem = async () => {
    if (!user) {
      setError('Önce giriş yapmalısın.');
      return;
    }

    const normalized = code.trim();
    if (!normalized) {
      setMessage(null);
      setError('Promo kodu girin.');
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const jwt = await account.createJWT();
      const response = await fetch('/api/promos/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt.jwt}`,
        },
        body: JSON.stringify({ code: normalized }),
      });

      const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string; message?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Promo kodu uygulanamadı.');
      }

      setCode('');
      setMessage(payload.message || 'Promo kodu başarıyla uygulandı.');
      await refreshProfile();
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : 'Promo kodu uygulanamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#101A2F] p-4">
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <Ticket size={16} className="text-cyan-300" />
        <p className="font-mono text-sm uppercase tracking-widest text-slate-300">Promo Kodu Redeem</p>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Buraya manuel girilen kodlar sadece rapido veya premium hediyeleri için kullanılır. İndirim kodları alışveriş ekranında çalışır.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="PROMO-2026"
          className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/50"
        />
        <button
          type="button"
          onClick={() => void handleRedeem()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-mono uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <BadgePercent size={14} />}
          Redeem Et
        </button>
      </div>

      {message && (
        <p className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}
    </div>
  );
}
