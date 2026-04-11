'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserCircle2,
  Crown,
  PenTool,
  TrendingUp,
  Shield,
  GalleryHorizontal,
  History,
  Loader2,
  Sparkles,
  Globe2,
  Lock,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { account } from '@/lib/appwrite';
import { EduVerificationCard } from '@/components/EduVerificationCard';
import { PromoRedeemCard } from '@/components/PromoRedeemCard';
import { ReferralCard } from '@/components/ReferralCard';

interface ProfileStepProps {
  onUpgradeClick: () => void;
  onOpenRapidoShop: () => void;
  onOpenAccountDetails: () => void;
  onOpenHistory: () => void;
  onAuthRequired: () => void;
}

type ProfileStats = {
  historyTotal: number;
  approvedTotal: number;
  archivedTotal: number;
  pendingTotal: number;
};

type BillingSummary = {
  totalAmountCents: number;
  totalRapidoPurchased: number;
  rapidoPurchaseCount: number;
  membershipPurchaseCount: number;
};

type MemorySnippetItem = {
  id: string;
  category: string;
  snippet: string;
  updatedFromOperation: string | null;
  updatedAt: string;
};

function getMemoryCategoryLabel(category: string): string {
  if (category === 'USER_PROFILE' || category === 'CATEGORY_1') return 'Kalıcı Kullanıcı Bilgileri';
  if (category === 'RECENT_CONTEXT' || category === 'CATEGORY_2') return 'Geçici Kullanım Bağlamı';
  if (category === 'ARCHITECT_STYLE_HIDDEN' || category === 'CATEGORY_3') return 'Gizli Mimari Stil';
  return category;
}

const DELETE_REASON_OPTIONS = [
  { value: 'yanlis', label: 'Yanlis' },
  { value: 'hatali', label: 'Hatali' },
  { value: 'guncel_degil', label: 'Guncel degil' },
  { value: 'artik_kullanilmiyor', label: 'Artik kullanilmiyor' },
] as const;

function formatCurrency(cents: number, currency: string): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: (currency || 'try').toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

export function ProfileStep({ onUpgradeClick, onOpenRapidoShop, onOpenAccountDetails, onOpenHistory, onAuthRequired }: ProfileStepProps) {
  const { user, profile, refreshProfile, setPreferredLanguage } = useAuth();
  const [stats, setStats] = useState<ProfileStats>({
    historyTotal: 0,
    approvedTotal: 0,
    archivedTotal: 0,
    pendingTotal: 0,
  });
  const [billingSummary, setBillingSummary] = useState<BillingSummary>({
    totalAmountCents: 0,
    totalRapidoPurchased: 0,
    rapidoPurchaseCount: 0,
    membershipPurchaseCount: 0,
  });
  const [memorySnippets, setMemorySnippets] = useState<MemorySnippetItem[]>([]);
  const [deletingSnippetId, setDeletingSnippetId] = useState<string | null>(null);
  const [deleteReasonPickerSnippetId, setDeleteReasonPickerSnippetId] = useState<string | null>(null);
  const [billingCurrency, setBillingCurrency] = useState('try');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const jwt = await account.createJWT();
      const headers = { Authorization: `Bearer ${jwt.jwt}` };

      const [historyRes, approvedRes, archivedRes, pendingRes, billingRes, memoryRes] = await Promise.all([
        fetch('/api/analysis-history?limit=1&offset=0', { headers }),
        fetch('/api/gallery?mine=1&status=approved&limit=1&offset=0', { headers }),
        fetch('/api/gallery?mine=1&status=archived&limit=1&offset=0', { headers }),
        fetch('/api/gallery?mine=1&status=pending&limit=1&offset=0', { headers }),
        fetch('/api/billing/history?limit=1&offset=0', { headers }),
        fetch('/api/memory-snippets', { headers }),
      ]);

      if (!historyRes.ok) {
        const payload = await historyRes.json().catch(() => ({}));
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Profil istatistikleri alınamadı.');
      }

      const historyPayload = (await historyRes.json()) as { total?: number };
      const approvedPayload = approvedRes.ok ? (await approvedRes.json().catch(() => ({}))) as { total?: number } : {};
      const archivedPayload = archivedRes.ok ? (await archivedRes.json().catch(() => ({}))) as { total?: number } : {};
      const pendingPayload = pendingRes.ok ? (await pendingRes.json().catch(() => ({}))) as { total?: number } : {};
      const billingPayload = billingRes.ok ? (await billingRes.json().catch(() => ({}))) as {
        summary?: BillingSummary;
        items?: Array<{ currency?: string }>;
      } : {};
      const memoryPayload = memoryRes.ok ? (await memoryRes.json().catch(() => ({}))) as {
        items?: MemorySnippetItem[];
      } : {};

      setStats({
        historyTotal: typeof historyPayload.total === 'number' ? historyPayload.total : 0,
        approvedTotal: typeof approvedPayload.total === 'number' ? approvedPayload.total : 0,
        archivedTotal: typeof archivedPayload.total === 'number' ? archivedPayload.total : 0,
        pendingTotal: typeof pendingPayload.total === 'number' ? pendingPayload.total : 0,
      });

      setBillingSummary({
        totalAmountCents: Number.isFinite(billingPayload.summary?.totalAmountCents)
          ? Number(billingPayload.summary?.totalAmountCents)
          : 0,
        totalRapidoPurchased: Number.isFinite(billingPayload.summary?.totalRapidoPurchased)
          ? Number(billingPayload.summary?.totalRapidoPurchased)
          : 0,
        rapidoPurchaseCount: Number.isFinite(billingPayload.summary?.rapidoPurchaseCount)
          ? Number(billingPayload.summary?.rapidoPurchaseCount)
          : 0,
        membershipPurchaseCount: Number.isFinite(billingPayload.summary?.membershipPurchaseCount)
          ? Number(billingPayload.summary?.membershipPurchaseCount)
          : 0,
      });
      setMemorySnippets(Array.isArray(memoryPayload.items) ? memoryPayload.items : []);
      setBillingCurrency((billingPayload.items?.[0]?.currency || 'try').toLowerCase());
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Profil istatistikleri alınamadı.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleDeleteMemorySnippet = useCallback(async (snippetId: string, reason: string) => {
    setDeletingSnippetId(snippetId);
    try {
      const jwt = await account.createJWT();
      const response = await fetch('/api/memory-snippets', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt.jwt}`,
        },
        body: JSON.stringify({
          snippetId,
          reason,
        }),
      });

      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || 'Hafıza notu silinemedi.');
      }

      setMemorySnippets((prev) => prev.filter((entry) => entry.id !== snippetId));
      setDeleteReasonPickerSnippetId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Hafıza notu silinemedi.');
    } finally {
      setDeletingSnippetId(null);
    }
  }, []);

  const handleLanguageChange = useCallback((nextLanguage: 'tr' | 'en') => {
    void setPreferredLanguage(nextLanguage);
  }, [setPreferredLanguage]);

  const handlePasswordUpdate = useCallback(async () => {
    if (!newPassword.trim()) {
      setPasswordMessage(null);
      setError('Yeni şifre zorunludur.');
      return;
    }

    setPasswordLoading(true);
    setError(null);
    setPasswordMessage(null);

    try {
      await account.updatePassword({
        password: newPassword,
        oldPassword: currentPassword || undefined,
      });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage('Şifre güncellendi. Yeni şifrenle tekrar giriş yapabilirsin.');
    } catch (passwordError) {
      setError(passwordError instanceof Error ? passwordError.message : 'Şifre güncellenemedi.');
    } finally {
      setPasswordLoading(false);
    }
  }, [currentPassword, newPassword]);


  if (!user) {
    return (
      <motion.div
        key="profile"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full max-w-3xl mx-auto mt-4"
      >
        <div className="rounded-2xl border border-white/10 bg-[#0E1628] p-8 text-center">
          <UserCircle2 className="mx-auto text-slate-400 mb-4" size={40} />
          <h2 className="font-display text-3xl text-white uppercase tracking-wider">Profil</h2>
          <p className="mt-3 text-slate-300 max-w-xl mx-auto">
            Profil ve istatistik ekranını görmek için giriş yapmalısın. Giriş yaptıktan sonra Rapido, analiz geçmişi ve galeri yönetimini buradan kontrol edebilirsin.
          </p>
          <button
            type="button"
            onClick={onAuthRequired}
            className="mt-6 px-6 py-3 rounded-lg bg-white text-black font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
          >
            Giriş Yap
          </button>
        </div>
      </motion.div>
    );
  }

  const isPremium = profile?.is_premium ?? false;
  const rapido = profile?.rapido_pens ?? 0;
  const progression = profile?.progression_score ?? 0;
  const wallCount = profile?.wall_of_death_count ?? 0;
  const badges = profile?.earned_badges ?? [];
  const currentLanguage = profile?.preferred_language === 'en' ? 'en' : 'tr';

  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-4xl mx-auto mt-4"
    >
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-display text-3xl text-white uppercase tracking-wider flex items-center gap-2">
            <UserCircle2 className="text-cyan-300" /> Profil ve Ayarlar
          </h2>
          <p className="text-slate-400 mt-1 text-sm">Hesap seviyeni, kullanım durumunu ve galeri durumunu tek ekrandan yönet.</p>
        </div>
        <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenRapidoShop}
              className="px-4 py-2 rounded-lg border border-neon-red/40 bg-neon-red/10 text-neon-red text-sm font-mono uppercase tracking-wider hover:bg-neon-red/20"
            >
              Rapido Mağaza
            </button>
          {!isPremium && (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="px-4 py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 text-sm font-mono uppercase tracking-wider hover:bg-yellow-500/20"
            >
              Premium&apos;a Geç
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200 text-sm font-mono">
          {error}
        </div>
      )}

      <div className="mb-6">
        <EduVerificationCard
          eduVerified={Boolean(profile?.edu_verified)}
          verifiedEduEmail={profile?.edu_email ?? null}
          pendingEduEmail={profile?.edu_verification_email ?? null}
          onVerified={refreshProfile}
        />
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-[#101A2F] p-4">
        <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300 border-b border-white/10 pb-2 flex items-center gap-2">
          <Globe2 size={14} className="text-cyan-300" /> Kişisel Ayarlar
        </h3>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Dil Tercihi</p>
            <p className="mt-1 text-sm text-slate-300">Arayüz ve AI yanıtları için varsayılan dili seç.</p>
            <div className="mt-3 inline-flex items-center rounded-full border border-white/15 bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => handleLanguageChange('tr')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest ${currentLanguage === 'tr' ? 'bg-white text-black' : 'text-slate-300 hover:text-white'}`}
              >
                TR
              </button>
              <button
                type="button"
                onClick={() => handleLanguageChange('en')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest ${currentLanguage === 'en' ? 'bg-white text-black' : 'text-slate-300 hover:text-white'}`}
              >
                EN
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Şifre Değiştir</p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Mevcut Şifre</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                  placeholder="Mevcut şifre"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">Yeni Şifre</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                  placeholder="Yeni şifre"
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <Lock size={12} /> Hesap güvenliği
              </div>
              <button
                type="button"
                onClick={() => void handlePasswordUpdate()}
                disabled={passwordLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-cyan-100 text-xs font-mono uppercase tracking-wider hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {passwordLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                Şifreyi Güncelle
              </button>
            </div>
            {passwordMessage && (
              <p className="mt-3 text-sm text-emerald-300">{passwordMessage}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">Üyelik</p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <Crown size={18} className={isPremium ? 'text-yellow-400' : 'text-slate-500'} />
            {isPremium ? 'Premium' : 'Kayıtlı'}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">Rapido</p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <PenTool size={18} className="text-neon-red" /> {rapido.toFixed(1)}x
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">Progression</p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-400" /> {progression}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">Wall Count</p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <Shield size={18} className="text-red-400" /> {wallCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-[#101A2F] p-5">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300 border-b border-white/10 pb-2 flex items-center gap-2">
            <History size={16} className="text-cyan-300" /> Analiz ve Galeri Özeti
          </h3>

          {isLoading ? (
            <div className="py-8 flex items-center justify-center text-slate-400">
              <Loader2 size={18} className="animate-spin mr-2" /> Yükleniyor...
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span>Toplam analiz geçmişi</span>
                <span className="font-bold">{stats.historyTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Aktif galeri paylaşımları</span>
                <span className="font-bold text-emerald-300">{stats.approvedTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Galeriden kaldırılanlar</span>
                <span className="font-bold text-amber-200">{stats.archivedTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Onay bekleyenler</span>
                <span className="font-bold text-slate-300">{stats.pendingTotal}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#101A2F] p-5">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300 border-b border-white/10 pb-2 flex items-center gap-2">
            <GalleryHorizontal size={16} className="text-neon-red" /> Rozetler ve Kişisel Ayarlar
          </h3>

          <div className="mt-4">
            {badges.length === 0 ? (
              <p className="text-sm text-slate-400">Henüz rozet kazanılmadı.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-4">
                {badges.map((badge) => (
                  <span
                    key={badge.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono border border-yellow-500/30 bg-yellow-500/10 text-yellow-100"
                  >
                    <Sparkles size={10} /> {badge.name}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-300">
                Varsayılan analiz uzunluğu ayarı yakında profil üzerinden yönetilebilir olacak.
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-300">
                Premium kelime hedefi seçimi altyapısı hazırlandı.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-[#101A2F] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300">Üyelik ve Satın Alım Özeti</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenHistory}
              className="px-3 py-2 rounded-lg border border-indigo-400/40 bg-indigo-500/10 text-indigo-100 text-xs font-mono uppercase tracking-wider hover:bg-indigo-500/20"
            >
              Analiz Geçmişi
            </button>
            <button
              type="button"
              onClick={onOpenAccountDetails}
              className="px-3 py-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-cyan-100 text-xs font-mono uppercase tracking-wider hover:bg-cyan-500/20"
            >
              Premium Yönetimi
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-slate-400 text-xs font-mono uppercase">Toplam Ödeme</p>
            <p className="text-white font-display text-lg mt-1">{formatCurrency(billingSummary.totalAmountCents, billingCurrency)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-slate-400 text-xs font-mono uppercase">Toplam Rapido Alımı</p>
            <p className="text-white font-display text-lg mt-1">{billingSummary.totalRapidoPurchased}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-slate-400 text-xs font-mono uppercase">Rapido İşlem Sayısı</p>
            <p className="text-white font-display text-lg mt-1">{billingSummary.rapidoPurchaseCount}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-slate-400 text-xs font-mono uppercase">Üyelik Satın Alımı</p>
            <p className="text-white font-display text-lg mt-1">{billingSummary.membershipPurchaseCount}</p>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <ReferralCard />
      </div>

      <div className="mt-6">
        <PromoRedeemCard />
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-[#101A2F] p-5">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300">AI Hafiza Notlari</h3>
        </div>

        {memorySnippets.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">Henüz görünür AI hafıza notu yok.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {memorySnippets.map((snippet) => (
              <article key={snippet.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-200">{getMemoryCategoryLabel(snippet.category)}</p>
                    <p className="mt-1 text-xs text-slate-500 font-mono">{new Date(snippet.updatedAt).toLocaleString('tr-TR')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteReasonPickerSnippetId(snippet.id)}
                    disabled={deletingSnippetId === snippet.id}
                    className="px-2.5 py-1.5 rounded border border-red-400/40 bg-red-500/10 text-red-200 text-[10px] font-mono uppercase tracking-wider hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {deletingSnippetId === snippet.id ? 'Siliniyor...' : 'Sil'}
                  </button>
                </div>
                {deleteReasonPickerSnippetId === snippet.id && (
                  <div className="mt-3 rounded-md border border-red-400/20 bg-red-500/5 p-2">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-red-200 mb-2">Silme nedeni sec</p>
                    <div className="flex flex-wrap gap-2">
                      {DELETE_REASON_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => void handleDeleteMemorySnippet(snippet.id, option.value)}
                          className="px-2 py-1 rounded border border-red-400/40 bg-red-500/10 text-red-100 text-[10px] font-mono uppercase tracking-wider hover:bg-red-500/20"
                        >
                          {option.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setDeleteReasonPickerSnippetId(null)}
                        className="px-2 py-1 rounded border border-white/20 bg-white/5 text-slate-200 text-[10px] font-mono uppercase tracking-wider hover:bg-white/10"
                      >
                        Vazgec
                      </button>
                    </div>
                  </div>
                )}
                <p className="mt-2 text-sm text-slate-200 whitespace-pre-line">{snippet.snippet}</p>
              </article>
            ))}
          </div>
        )}

      </div>
    </motion.div>
  );
}
