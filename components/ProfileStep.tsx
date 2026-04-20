'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
];

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

type ProfileStatsResponse = {
  stats?: ProfileStats;
  billingSummary?: BillingSummary;
  billingCurrency?: string;
  memorySnippets?: MemorySnippetItem[];
  error?: string;
};


function formatCurrency(cents: number, currency: string): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: (currency || 'try').toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

export function ProfileStep({ onUpgradeClick, onOpenRapidoShop, onOpenAccountDetails, onOpenHistory, onAuthRequired }: ProfileStepProps) {
  const language = useLanguage();
  const { user, profile, refreshProfile, setPreferredLanguage, getJWT } = useAuth();

  const deleteReasonOptions = useMemo(
    () =>
      [
        { value: 'yanlis' as const, label: pickLocalized(language, 'Yanlış', 'Incorrect') },
        { value: 'hatali' as const, label: pickLocalized(language, 'Hatalı', 'Faulty') },
        { value: 'guncel_degil' as const, label: pickLocalized(language, 'Güncel değil', 'Out of date') },
        { value: 'artik_kullanilmiyor' as const, label: pickLocalized(language, 'Artık kullanılmıyor', 'No longer used') },
      ] as const,
    [language],
  );

  const getMemoryCategoryLabel = useCallback(
    (category: string) => {
      if (category === 'USER_PROFILE' || category === 'CATEGORY_1') {
        return pickLocalized(language, 'Kalıcı Kullanıcı Bilgileri', 'Permanent user data');
      }
      if (category === 'RECENT_CONTEXT' || category === 'CATEGORY_2') {
        return pickLocalized(language, 'Geçici Kullanım Bağlamı', 'Recent context');
      }
      if (category === 'ARCHITECT_STYLE_HIDDEN' || category === 'CATEGORY_3') {
        return pickLocalized(language, 'Gizli Mimari Stil', 'Hidden architectural style');
      }
      return category;
    },
    [language],
  );
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
      const jwt = await getJWT();
      const headers = { Authorization: `Bearer ${jwt}` };

      const response = await fetch('/api/profile/stats', { headers });
      const payload = (await response.json().catch(() => ({}))) as ProfileStatsResponse;

      if (!response.ok) {
        throw new Error(
          typeof payload.error === 'string' && payload.error.trim()
            ? payload.error
            : pickLocalized(language, 'Profil istatistikleri alınamadı.', 'Could not load profile statistics.'),
        );
      }

      const nextStats = payload.stats;
      setStats({
        historyTotal: Number.isFinite(nextStats?.historyTotal) ? Number(nextStats?.historyTotal) : 0,
        approvedTotal: Number.isFinite(nextStats?.approvedTotal) ? Number(nextStats?.approvedTotal) : 0,
        archivedTotal: Number.isFinite(nextStats?.archivedTotal) ? Number(nextStats?.archivedTotal) : 0,
        pendingTotal: Number.isFinite(nextStats?.pendingTotal) ? Number(nextStats?.pendingTotal) : 0,
      });

      setBillingSummary({
        totalAmountCents: Number.isFinite(payload.billingSummary?.totalAmountCents)
          ? Number(payload.billingSummary?.totalAmountCents)
          : 0,
        totalRapidoPurchased: Number.isFinite(payload.billingSummary?.totalRapidoPurchased)
          ? Number(payload.billingSummary?.totalRapidoPurchased)
          : 0,
        rapidoPurchaseCount: Number.isFinite(payload.billingSummary?.rapidoPurchaseCount)
          ? Number(payload.billingSummary?.rapidoPurchaseCount)
          : 0,
        membershipPurchaseCount: Number.isFinite(payload.billingSummary?.membershipPurchaseCount)
          ? Number(payload.billingSummary?.membershipPurchaseCount)
          : 0,
      });

      setMemorySnippets(Array.isArray(payload.memorySnippets) ? payload.memorySnippets : []);
      setBillingCurrency((payload.billingCurrency || 'try').toLowerCase());
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : pickLocalized(language, 'Profil istatistikleri alınamadı.', 'Could not load profile statistics.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [getJWT, user, language]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const handleDeleteMemorySnippet = useCallback(async (snippetId: string, reason: string) => {
    setDeletingSnippetId(snippetId);
    try {
      const jwt = await getJWT();
      const response = await fetch('/api/memory-snippets', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          snippetId,
          reason,
        }),
      });

      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        throw new Error(
          payload.error || pickLocalized(language, 'Hafıza notu silinemedi.', 'Could not delete memory note.'),
        );
      }

      setMemorySnippets((prev) => prev.filter((entry) => entry.id !== snippetId));
      setDeleteReasonPickerSnippetId(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : pickLocalized(language, 'Hafıza notu silinemedi.', 'Could not delete memory note.'),
      );
    } finally {
      setDeletingSnippetId(null);
    }
  }, [getJWT, language]);

  const handleLanguageChange = useCallback((nextLanguage: SupportedLanguage) => {
    void setPreferredLanguage(nextLanguage);
  }, [setPreferredLanguage]);

  const handlePasswordUpdate = useCallback(async () => {
    if (!newPassword.trim()) {
      setPasswordMessage(null);
      setError(pickLocalized(language, 'Yeni şifre zorunludur.', 'New password is required.'));
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
      setPasswordMessage(
        pickLocalized(
          language,
          'Şifre güncellendi. Yeni şifrenle tekrar giriş yapabilirsin.',
          'Password updated. You can sign in again with your new password.',
        ),
      );
    } catch (passwordError) {
      setError(
        passwordError instanceof Error
          ? passwordError.message
          : pickLocalized(language, 'Şifre güncellenemedi.', 'Could not update password.'),
      );
    } finally {
      setPasswordLoading(false);
    }
  }, [currentPassword, newPassword, language]);


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
          <h2 className="font-display text-3xl text-white uppercase tracking-wider">
            {pickLocalized(language, 'Profil', 'Profile')}
          </h2>
          <p className="mt-3 text-slate-300 max-w-xl mx-auto">
            {pickLocalized(
              language,
              'Profil ve istatistik ekranını görmek için giriş yapmalısın. Giriş yaptıktan sonra Rapido, analiz geçmişi ve galeri yönetimini buradan kontrol edebilirsin.',
              'Sign in to view your profile and stats. After signing in, you can manage Rapido, analysis history, and gallery from here.',
            )}
          </p>
          <button
            type="button"
            onClick={onAuthRequired}
            className="mt-6 px-6 py-3 rounded-lg bg-white text-black font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
          >
            {pickLocalized(language, 'Giriş Yap', 'Sign in')}
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
  const currentLanguage = LANGUAGE_OPTIONS.find((option) => option.value === (profile?.preferred_language === 'en' || profile?.preferred_language === 'de' || profile?.preferred_language === 'it' ? profile.preferred_language : 'tr'))?.value ?? 'tr';

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
            <UserCircle2 className="text-cyan-300" />{' '}
            {pickLocalized(language, 'Profil ve Ayarlar', 'Profile & settings')}
          </h2>
          <p className="text-slate-400 mt-1 text-sm">
            {pickLocalized(
              language,
              'Hesap seviyeni, kullanım durumunu ve galeri durumunu tek ekrandan yönet.',
              'Manage your account tier, usage, and gallery status from one screen.',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenRapidoShop}
              className="px-4 py-2 rounded-lg border border-neon-red/40 bg-neon-red/10 text-neon-red text-sm font-mono uppercase tracking-wider hover:bg-neon-red/20"
            >
              {pickLocalized(language, 'Rapido Mağaza', 'Rapido shop')}
            </button>
          {!isPremium && (
            <button
              type="button"
              onClick={onUpgradeClick}
              className="px-4 py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 text-sm font-mono uppercase tracking-wider hover:bg-yellow-500/20"
            >
              {pickLocalized(language, "Premium'a Geç", 'Go Premium')}
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
          <Globe2 size={14} className="text-cyan-300" />{' '}
          {pickLocalized(language, 'Kişisel Ayarlar', 'Personal settings')}
        </h3>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              {pickLocalized(language, 'Dil Tercihi', 'Language preference')}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {pickLocalized(
                language,
                'Arayüz ve AI yanıtları için varsayılan dili seç.',
                'Choose the default language for the UI and AI responses.',
              )}
            </p>
            <p className="mt-2 text-[11px] font-mono leading-relaxed text-cyan-200/80">
              {pickLocalized(
                language,
                'Bu tercih AI cevap dilidir. Arayuz dili footerdan degisir ve sadece tarayicida saklanir.',
                'This controls AI response language. UI language changes from the footer and stays in the browser.',
              )}
            </p>
            <label className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-200">
              <Globe2 size={14} className="text-cyan-300 shrink-0" />
              <span className="sr-only">{pickLocalized(language, 'Dil seçimi', 'Language selection')}</span>
              <select
                value={currentLanguage}
                onChange={(event) => handleLanguageChange(event.target.value as SupportedLanguage)}
                className="w-full bg-transparent text-sm text-white outline-none"
                aria-label={pickLocalized(language, 'Dil seçimi', 'Language selection')}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#0A0F1A] text-white">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
              {pickLocalized(language, 'Şifre Değiştir', 'Change password')}
            </p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  {pickLocalized(language, 'Mevcut Şifre', 'Current password')}
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                  placeholder={pickLocalized(language, 'Mevcut şifre', 'Current password')}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                  {pickLocalized(language, 'Yeni Şifre', 'New password')}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400"
                  placeholder={pickLocalized(language, 'Yeni şifre', 'New password')}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                <Lock size={12} /> {pickLocalized(language, 'Hesap güvenliği', 'Account security')}
              </div>
              <button
                type="button"
                onClick={() => void handlePasswordUpdate()}
                disabled={passwordLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-cyan-100 text-xs font-mono uppercase tracking-wider hover:bg-cyan-500/20 disabled:opacity-50"
              >
                {passwordLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {pickLocalized(language, 'Şifreyi Güncelle', 'Update password')}
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
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            {pickLocalized(language, 'Üyelik', 'Membership')}
          </p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <Crown size={18} className={isPremium ? 'text-yellow-400' : 'text-slate-500'} />
            {isPremium ? 'Premium' : pickLocalized(language, 'Kayıtlı', 'Registered')}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">{pickLocalized(language, 'Rapido', 'Rapido')}</p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <PenTool size={18} className="text-neon-red" /> {rapido.toFixed(1)}x
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">{pickLocalized(language, 'Gelişim', 'Progression')}</p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-400" /> {progression}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">{pickLocalized(language, 'Wall of Death Sayısı', 'Wall of Death count')}</p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <Shield size={18} className="text-red-400" /> {wallCount}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/10 bg-[#101A2F] p-5">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300 border-b border-white/10 pb-2 flex items-center gap-2">
            <History size={16} className="text-cyan-300" />{' '}
            {pickLocalized(language, 'Analiz ve Galeri Özeti', 'Analysis & gallery summary')}
          </h3>

          {isLoading ? (
            <div className="py-8 flex items-center justify-center text-slate-400">
              <Loader2 size={18} className="animate-spin mr-2" />{' '}
              {pickLocalized(language, 'Yükleniyor...', 'Loading...')}
            </div>
          ) : (
            <div className="mt-4 space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span>{pickLocalized(language, 'Toplam analiz geçmişi', 'Total analyses in history')}</span>
                <span className="font-bold">{stats.historyTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{pickLocalized(language, 'Aktif galeri paylaşımları', 'Active gallery posts')}</span>
                <span className="font-bold text-emerald-300">{stats.approvedTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{pickLocalized(language, 'Galeriden kaldırılanlar', 'Removed from gallery')}</span>
                <span className="font-bold text-amber-200">{stats.archivedTotal}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{pickLocalized(language, 'Onay bekleyenler', 'Pending approval')}</span>
                <span className="font-bold text-slate-300">{stats.pendingTotal}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#101A2F] p-5">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300 border-b border-white/10 pb-2 flex items-center gap-2">
            <GalleryHorizontal size={16} className="text-neon-red" />{' '}
            {pickLocalized(language, 'Rozetler ve Kişisel Ayarlar', 'Badges & personal settings')}
          </h3>

          <div className="mt-4">
            {badges.length === 0 ? (
              <p className="text-sm text-slate-400">
                {pickLocalized(language, 'Henüz rozet kazanılmadı.', 'No badges earned yet.')}
              </p>
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
                {pickLocalized(
                  language,
                  'Varsayılan analiz uzunluğu ayarı yakında profil üzerinden yönetilebilir olacak.',
                  'Default analysis length will soon be manageable from your profile.',
                )}
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-300">
                {pickLocalized(
                  language,
                  'Premium kelime hedefi seçimi altyapısı hazırlandı.',
                  'Premium word-target selection infrastructure is ready.',
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-white/10 bg-[#101A2F] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300">
              {pickLocalized(language, 'Üyelik ve Satın Alım Özeti', 'Membership & purchase summary')}
            </h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenHistory}
              className="px-3 py-2 rounded-lg border border-indigo-400/40 bg-indigo-500/10 text-indigo-100 text-xs font-mono uppercase tracking-wider hover:bg-indigo-500/20"
            >
              {pickLocalized(language, 'Analiz Geçmişi', 'Analysis history')}
            </button>
            <button
              type="button"
              onClick={onOpenAccountDetails}
              className="px-3 py-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-cyan-100 text-xs font-mono uppercase tracking-wider hover:bg-cyan-500/20"
            >
              {pickLocalized(language, 'Premium Yönetimi', 'Premium management')}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-slate-400 text-xs font-mono uppercase">
              {pickLocalized(language, 'Toplam Ödeme', 'Total paid')}
            </p>
            <p className="text-white font-display text-lg mt-1">{formatCurrency(billingSummary.totalAmountCents, billingCurrency)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-slate-400 text-xs font-mono uppercase">
              {pickLocalized(language, 'Toplam Rapido Alımı', 'Total Rapido purchased')}
            </p>
            <p className="text-white font-display text-lg mt-1">{billingSummary.totalRapidoPurchased}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-slate-400 text-xs font-mono uppercase">
              {pickLocalized(language, 'Rapido İşlem Sayısı', 'Rapido purchase count')}
            </p>
            <p className="text-white font-display text-lg mt-1">{billingSummary.rapidoPurchaseCount}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
            <p className="text-slate-400 text-xs font-mono uppercase">
              {pickLocalized(language, 'Üyelik Satın Alımı', 'Membership purchases')}
            </p>
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
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300">
            {pickLocalized(language, 'AI Hafıza Notları', 'AI memory notes')}
          </h3>
        </div>

        {memorySnippets.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            {pickLocalized(language, 'Henüz görünür AI hafıza notu yok.', 'No visible AI memory notes yet.')}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {memorySnippets.map((snippet) => (
              <article key={snippet.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-200">{getMemoryCategoryLabel(snippet.category)}</p>
                    <p className="mt-1 text-xs text-slate-500 font-mono">
                      {new Date(snippet.updatedAt).toLocaleString(language === 'en' ? 'en-US' : 'tr-TR')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteReasonPickerSnippetId(snippet.id)}
                    disabled={deletingSnippetId === snippet.id}
                    className="px-2.5 py-1.5 rounded border border-red-400/40 bg-red-500/10 text-red-200 text-[10px] font-mono uppercase tracking-wider hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {deletingSnippetId === snippet.id
                      ? pickLocalized(language, 'Siliniyor...', 'Deleting...')
                      : pickLocalized(language, 'Sil', 'Delete')}
                  </button>
                </div>
                {deleteReasonPickerSnippetId === snippet.id && (
                  <div className="mt-3 rounded-md border border-red-400/20 bg-red-500/5 p-2">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-red-200 mb-2">
                      {pickLocalized(language, 'Silme nedeni seç', 'Choose a reason')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {deleteReasonOptions.map((option) => (
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
                        {pickLocalized(language, 'Vazgeç', 'Cancel')}
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
