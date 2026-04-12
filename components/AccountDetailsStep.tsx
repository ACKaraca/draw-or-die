'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Crown, Loader2, PenTool, ReceiptText, WalletCards } from 'lucide-react';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

type BillingHistoryItem = {
  id: string;
  createdAt: string;
  eventType: string;
  amountCents: number;
  currency: string;
  rapidoDelta: number;
  rapidoBalanceAfter: number;
  stripeSessionId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  metadataJson: string | null;
};

type BillingMembershipInfo = {
  isPremium: boolean;
  rapidoBalance: number;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  subscriptionStatus: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  premiumStartedAt: string | null;
  premiumPriceCents: number | null;
  premiumCurrency: string | null;
  premiumInterval: string | null;
  premiumPromoCode: string | null;
  daysRemaining: number | null;
};

type BillingSummary = {
  totalAmountCents: number;
  totalRapidoPurchased: number;
  rapidoPurchaseCount: number;
  membershipPurchaseCount: number;
};

type BillingHistoryResponse = {
  membership: BillingMembershipInfo;
  summary: BillingSummary;
  items: BillingHistoryItem[];
  total: number;
};

interface AccountDetailsStepProps {
  onBack: () => void;
  onOpenRapidoShop: () => void;
  onOpenPremiumShop: () => void;
  onAuthRequired: () => void;
}

const PAGE_SIZE = 20;

function formatCurrency(cents: number, currency: string, language: SupportedLanguage): string {
  const normalized = (currency || 'try').toLowerCase();
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  const locale = language === 'en' ? 'en-US' : 'tr-TR';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalized.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null, language: SupportedLanguage): string {
  if (!value) return '-';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '-';
  return new Date(parsed).toLocaleDateString(language === 'en' ? 'en-US' : 'tr-TR');
}

function formatInterval(value: string | null, language: SupportedLanguage): string {
  if (!value) return '-';
  if (value === 'month') return pickLocalized(language, 'Aylık', 'Monthly');
  if (value === 'year') return pickLocalized(language, 'Yıllık', 'Yearly');
  return value;
}

function toEventLabel(eventType: string, language: SupportedLanguage): string {
  switch (eventType) {
    case 'premium_monthly':
      return pickLocalized(language, 'Premium Aylık Üyelik', 'Premium monthly');
    case 'premium_yearly':
      return pickLocalized(language, 'Premium Yıllık Üyelik', 'Premium yearly');
    case 'rapido_pack':
      return pickLocalized(language, 'Rapido Satın Alımı', 'Rapido purchase');
    default:
      return eventType || pickLocalized(language, 'Satın Alım', 'Purchase');
  }
}

function pickMembershipLabel(language: SupportedLanguage, value: boolean): string {
  return value ? pickLocalized(language, 'Evet', 'Yes') : pickLocalized(language, 'Hayır', 'No');
}

function readPromoCode(metadataJson: string | null): string {
  if (!metadataJson) return '';
  try {
    const parsed = JSON.parse(metadataJson) as { promoCode?: unknown };
    if (typeof parsed.promoCode !== 'string') return '';
    return parsed.promoCode.trim().substring(0, 64);
  } catch {
    return '';
  }
}

export function AccountDetailsStep({ onBack, onOpenRapidoShop, onOpenPremiumShop, onAuthRequired }: AccountDetailsStepProps) {
  const language = useLanguage();
  const { user } = useAuth();

  const [items, setItems] = useState<BillingHistoryItem[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [membership, setMembership] = useState<BillingMembershipInfo | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const jwt = await account.createJWT();

    const mergedHeaders: HeadersInit = {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${jwt.jwt}`,
    };

    return fetch(url, {
      ...init,
      headers: {
        ...mergedHeaders,
      },
    });
  }, []);

  const openBillingPortal = useCallback(async () => {
    if (!membership?.stripeCustomerId) {
      setError(
        pickLocalized(language, 'Bu hesap için Stripe üyelik kaydı bulunamadı.', 'No Stripe subscription record for this account.'),
      );
      return;
    }

    setIsPortalLoading(true);
    setError(null);
    try {
      const response = await authedFetch('/api/billing/portal', {
        method: 'POST',
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; url?: string };

      if (!response.ok || !payload.url) {
        throw new Error(
          payload.error ||
            pickLocalized(language, 'Abonelik yönetim sayfası açılamadı.', 'Could not open subscription management.'),
        );
      }

      window.location.href = payload.url;
    } catch (portalError) {
      setError(
        portalError instanceof Error
          ? portalError.message
          : pickLocalized(language, 'Abonelik yönetim sayfası açılamadı.', 'Could not open subscription management.'),
      );
    } finally {
      setIsPortalLoading(false);
    }
  }, [authedFetch, language, membership?.stripeCustomerId]);

  const fetchBilling = useCallback(
    async (nextOffset = 0, reset = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(nextOffset),
        });

        const response = await authedFetch(`/api/billing/history?${params.toString()}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            typeof payload?.error === 'string'
              ? payload.error
              : pickLocalized(language, 'Hesap detayları alınamadı.', 'Could not load account details.'),
          );
        }

        const payload = (await response.json()) as BillingHistoryResponse;
        const nextItems = Array.isArray(payload.items) ? payload.items : [];

        setMembership(payload.membership ?? null);
        setSummary(payload.summary ?? null);
        setTotal(typeof payload.total === 'number' ? payload.total : 0);

        if (reset) {
          setItems(nextItems);
        } else {
          setItems((prev) => [...prev, ...nextItems]);
        }

        setOffset(nextOffset + PAGE_SIZE);
      } catch (fetchError) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : pickLocalized(language, 'Hesap detayları alınamadı.', 'Could not load account details.'),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [authedFetch, language],
  );

  useEffect(() => {
    if (!user) return;
    void fetchBilling(0, true);
  }, [fetchBilling, user]);

  const hasMore = items.length < total;

  const primaryCurrency = useMemo(() => {
    const first = items[0]?.currency;
    return first || 'try';
  }, [items]);

  if (!user) {
    return (
      <motion.div
        key="account-details"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full max-w-3xl mt-24"
      >
        <div className="rounded-2xl border border-white/10 bg-[#0E1628] p-8 text-center">
          <h2 className="font-display text-3xl text-white uppercase tracking-wider">
            {pickLocalized(language, 'Hesap Detayları', 'Account details')}
          </h2>
          <p className="mt-3 text-slate-300">
            {pickLocalized(language, 'Satın alım geçmişini görmek için giriş yapmanız gerekiyor.', 'Sign in to view your purchase history.')}
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

  return (
    <motion.div
      key="account-details"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-7xl mt-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-wider"
        >
          <ArrowLeft size={14} /> {pickLocalized(language, 'Profile Dön', 'Back to profile')}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenRapidoShop}
            className="px-3 py-2 rounded-lg border border-neon-red/40 bg-neon-red/10 text-neon-red text-xs font-mono uppercase tracking-wider hover:bg-neon-red/20"
          >
            {pickLocalized(language, 'Rapido Satın Al', 'Buy Rapido')}
          </button>
          <button
            type="button"
            onClick={onOpenPremiumShop}
            className="px-3 py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 text-xs font-mono uppercase tracking-wider hover:bg-yellow-500/20"
          >
            {pickLocalized(language, 'Premium Planlar', 'Premium plans')}
          </button>
          {membership?.stripeCustomerId && (
            <button
              type="button"
              onClick={() => void openBillingPortal()}
              disabled={isPortalLoading}
              className="px-3 py-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 text-cyan-100 text-xs font-mono uppercase tracking-wider hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {isPortalLoading
                ? pickLocalized(language, 'Yönetim Açılıyor...', 'Opening portal...')
                : pickLocalized(language, 'Abonelik Yönet', 'Manage subscription')}
            </button>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="font-display text-3xl text-white uppercase tracking-wider flex items-center gap-2">
          <WalletCards className="text-cyan-300" />{' '}
          {pickLocalized(language, 'Hesap ve Satın Alım Detayları', 'Account & purchase details')}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {pickLocalized(
            language,
            'Üyelik durumun, Rapido hareketlerin ve ödeme geçmişin burada tutulur.',
            'Your membership status, Rapido activity, and payment history are listed here.',
          )}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-200 text-sm font-mono">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            {pickLocalized(language, 'Üyelik', 'Membership')}
          </p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <Crown size={18} className={membership?.isPremium ? 'text-yellow-400' : 'text-slate-500'} />
            {membership?.isPremium ? 'Premium' : pickLocalized(language, 'Kayıtlı', 'Registered')}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            {pickLocalized(language, 'Mevcut Rapido', 'Current Rapido')}
          </p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <PenTool size={18} className="text-neon-red" /> {membership?.rapidoBalance ?? 0}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            {pickLocalized(language, 'Toplam Satın Alım', 'Total purchases')}
          </p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <ReceiptText size={18} className="text-cyan-300" />
            {summary ? formatCurrency(summary.totalAmountCents, primaryCurrency, language) : '-'}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            {pickLocalized(language, 'Toplam Rapido Alımı', 'Total Rapido purchased')}
          </p>
          <p className="text-white font-display text-xl flex items-center gap-2">
            <PenTool size={18} className="text-neon-red" /> {summary?.totalRapidoPurchased ?? 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            {pickLocalized(language, 'Kalan Gün', 'Days left')}
          </p>
          <p className="text-white font-display text-xl">{membership?.daysRemaining ?? '-'}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            {pickLocalized(language, 'Üyelik Başlangıcı', 'Membership started')}
          </p>
            <p className="text-white font-display text-xl">{formatDate(membership?.premiumStartedAt ?? null, language)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            {pickLocalized(language, 'Plan Ücreti', 'Plan price')}
          </p>
          <p className="text-white font-display text-xl">
            {membership?.premiumPriceCents
              ? formatCurrency(membership.premiumPriceCents, membership.premiumCurrency || 'try', language)
              : '-'}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0F1A2E] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
            {pickLocalized(language, 'Promo Kodu', 'Promo code')}
          </p>
          <p className="text-white font-display text-xl">{membership?.premiumPromoCode || '-'}</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-[#101A2F] p-4">
        <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300 border-b border-white/10 pb-2">{pickLocalized(language, 'Premium Durumu', 'Premium status')}</h3>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-slate-400 text-[11px] font-mono uppercase">{pickLocalized(language, 'Durum', 'Status')}</p>
            <p className="text-white">{membership?.subscriptionStatus || '-'}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-slate-400 text-[11px] font-mono uppercase">{pickLocalized(language, 'Yenileme Dönemi', 'Renewal period')}</p>
            <p className="text-white">
              {formatDate(membership?.currentPeriodStart ?? null, language)} - {formatDate(membership?.currentPeriodEnd ?? null, language)}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-slate-400 text-[11px] font-mono uppercase">{pickLocalized(language, 'Plan Tipi', 'Plan type')}</p>
            <p className="text-white">{formatInterval(membership?.premiumInterval ?? null, language)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-slate-400 text-[11px] font-mono uppercase">{pickLocalized(language, 'Dönem Sonu İptal', 'Cancel at period end')}</p>
            <p className="text-white">{pickMembershipLabel(language, Boolean(membership?.cancelAtPeriodEnd))}</p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/10 bg-[#101A2F] p-4">
        <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300 border-b border-white/10 pb-2">{pickLocalized(language, 'Premium Avantajları', 'Premium benefits')}</h3>
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-200">
          <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2">{pickLocalized(language, '2-4 personeli çoklu jüri analizi', 'Multi-jury analysis for 2-4 personas')}</li>
          <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2">{pickLocalized(language, 'AI Mentor ve gelişmiş sohbet limiti', 'AI Mentor and extended chat limit')}</li>
          <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2">{pickLocalized(language, 'Premium Rescue ve revizyon akışlarına erişim', 'Access to Premium Rescue and revision flows')}</li>
          <li className="rounded-md border border-white/10 bg-white/5 px-3 py-2">{pickLocalized(language, 'Abonelik yönetimi, ödeme yöntemi değiştirme ve portal erişimi', 'Subscription management, payment method changes, and portal access')}</li>
        </ul>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#101A2F] p-4 sm:p-5">
        <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300 border-b border-white/10 pb-2">
          {pickLocalized(language, 'Satın Alım Hareketleri', 'Purchase history')}
        </h3>

        {isLoading && items.length === 0 ? (
          <div className="py-8 flex items-center justify-center text-slate-400">
            <Loader2 size={18} className="animate-spin mr-2" /> {pickLocalized(language, 'Yükleniyor...', 'Loading...')}
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm font-mono">
            {pickLocalized(language, 'Henüz satın alım kaydı bulunmuyor.', 'No purchase records yet.')}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left border-b border-white/10 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-2 pr-4">{pickLocalized(language, 'Tarih', 'Date')}</th>
                  <th className="py-2 pr-4">{pickLocalized(language, 'İşlem', 'Transaction')}</th>
                  <th className="py-2 pr-4">{pickLocalized(language, 'Tutar', 'Amount')}</th>
                  <th className="py-2 pr-4">{pickLocalized(language, 'Rapido Değişim', 'Rapido change')}</th>
                  <th className="py-2 pr-4">{pickLocalized(language, 'Bakiye Sonrası', 'Balance after')}</th>
                  <th className="py-2">Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((item) => {
                  const promoCode = readPromoCode(item.metadataJson);

                  return (
                    <tr key={item.id} className="text-slate-200">
                      <td className="py-3 pr-4 font-mono text-xs text-slate-400">{new Date(item.createdAt).toLocaleString('tr-TR')}</td>
                      <td className="py-3 pr-4">
                        <p>{toEventLabel(item.eventType, language)}</p>
                        {promoCode && (
                          <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-300">
                            {pickLocalized(language, 'Promosyon:', 'Promo:')} {promoCode}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono">{formatCurrency(item.amountCents, item.currency, language)}</td>
                      <td className={`py-3 pr-4 font-mono ${item.rapidoDelta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        {item.rapidoDelta >= 0 ? '+' : ''}
                        {item.rapidoDelta}
                      </td>
                      <td className="py-3 pr-4 font-mono">{item.rapidoBalanceAfter}</td>
                      <td className="py-3 font-mono text-xs text-slate-500">{item.stripeSessionId || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={() => void fetchBilling(offset)}
            disabled={isLoading}
            className="px-6 py-2 rounded-lg border border-white/20 text-white font-mono text-xs uppercase tracking-wider hover:bg-white/10 disabled:opacity-50"
          >
            {isLoading ? pickLocalized(language, 'Yükleniyor...', 'Loading...') : pickLocalized(language, 'Daha Fazla Kayıt', 'Load more records')}
          </button>
        </div>
      )}
    </motion.div>
  );
}
