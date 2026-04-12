'use client';

import { motion } from 'framer-motion';
import { Crown, PenTool, Shield, Brain, Users, Palette, ArrowLeft, Sparkles, GraduationCap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { STRIPE_PRICES, RAPIDO_COSTS, resolveStripeTierForUser } from '@/lib/pricing';
import { account } from '@/lib/appwrite';
import { EduVerificationCard } from '@/components/EduVerificationCard';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import type { StepType } from '@/types';
import { rapidoCostOperationLabel } from '@/lib/locales/rapidoOperations';

interface PremiumUpgradeStepProps {
    setStep: (step: StepType) => void;
    initialTab?: Tab;
}

type Tab = 'premium' | 'rapido';
type BillingCycle = 'monthly' | 'yearly';

type PromoValidationResponse = {
    valid?: boolean;
    source?: 'internal' | 'stripe';
    promotionCodeId?: string;
    promoCode?: string;
    error?: string;
    summary?: string;
    coupon?: {
        percentOff?: number | null;
        amountOff?: number | null;
        currency?: string | null;
    };
};

export function PremiumUpgradeStep({ setStep, initialTab = 'premium' }: PremiumUpgradeStepProps) {
    const language = useLanguage();
    const { user, profile, refreshProfile } = useAuth();
    const [tab, setTab] = useState<Tab>(initialTab);
    const [billing, setBilling] = useState<BillingCycle>('monthly');
    const [rapidoQty, setRapidoQty] = useState(10);
    const [loading, setLoading] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [promoValidationId, setPromoValidationId] = useState<string>('');
    const [promoSummary, setPromoSummary] = useState<string>('');
    const [promoError, setPromoError] = useState<string>('');
    const [promoLoading, setPromoLoading] = useState(false);

    const email = user?.email ?? '';
    const tierKey = resolveStripeTierForUser({
        primaryEmail: email,
        eduVerified: profile?.edu_verified,
        eduEmail: profile?.edu_email,
    });
    const tier = STRIPE_PRICES[tierKey];
    const isAkdenizStudent = tierKey === 'AKDENIZ_STUDENT';
    const isTrStudent = tierKey !== 'GLOBAL';
    const currency = tier.CURRENCY === 'try' ? '₺' : '$';
    const divider = 100;

    const premiumPrice = billing === 'monthly'
        ? (tier.MONTHLY / divider).toFixed(2)
        : (tier.YEARLY / divider).toFixed(2);

    const monthlyEquiv = billing === 'yearly'
        ? (tier.YEARLY / divider / 12).toFixed(2)
        : null;

    const rapidoUnitPrice = (tier.RAPIDO_UNIT / divider).toFixed(2);
    const rapidoTotal = ((tier.RAPIDO_UNIT * rapidoQty) / divider).toFixed(2);

    useEffect(() => {
        setTab(initialTab);
    }, [initialTab]);

    const numberLocale = language === 'en' ? 'en-US' : 'tr-TR';

    const formatCurrency = (amountCents: number, code: string): string => {
        return new Intl.NumberFormat(numberLocale, {
            style: 'currency',
            currency: (code || 'try').toUpperCase(),
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format((amountCents || 0) / 100);
    };

    const describeCoupon = (payload: PromoValidationResponse): string => {
        const percentOff = Number.isFinite(payload.coupon?.percentOff)
            ? Number(payload.coupon?.percentOff)
            : null;
        if (percentOff !== null && percentOff > 0) {
            return pickLocalized(language, `%${percentOff} indirim aktif`, `${percentOff}% discount applied`);
        }

        const amountOff = Number.isFinite(payload.coupon?.amountOff)
            ? Number(payload.coupon?.amountOff)
            : null;
        const couponCurrency = (payload.coupon?.currency || tier.CURRENCY || 'try').toLowerCase();
        if (amountOff !== null && amountOff > 0) {
            return pickLocalized(
                language,
                `${formatCurrency(amountOff, couponCurrency)} indirim aktif`,
                `${formatCurrency(amountOff, couponCurrency)} discount applied`,
            );
        }

        return pickLocalized(language, 'Promo kodu aktif', 'Promo code applied');
    };

    const handleValidatePromo = async () => {
        if (!user) {
            alert(pickLocalized(language, 'Lütfen önce giriş yapın.', 'Please sign in first.'));
            return;
        }

        const code = promoCode.trim();
        if (!code) {
            setPromoError(pickLocalized(language, 'Promo kodu girin.', 'Enter a promo code.'));
            setPromoValidationId('');
            setPromoSummary('');
            return;
        }

        setPromoLoading(true);
        setPromoError('');
        try {
            const jwt = await account.createJWT();
            const res = await fetch('/api/checkout/validate-promo', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt.jwt}`,
                },
                body: JSON.stringify({
                    code,
                    mode: tab === 'rapido' ? 'rapido_pack' : billing === 'yearly' ? 'premium_yearly' : 'premium_monthly',
                }),
            });

            const data = (await res.json().catch(() => ({}))) as PromoValidationResponse;
            if (!res.ok || !data.valid || !data.promotionCodeId) {
                setPromoValidationId('');
                setPromoSummary('');
                setPromoError(
                    data.error || pickLocalized(language, 'Promo kodu geçersiz.', 'Invalid promo code.'),
                );
                return;
            }

            setPromoValidationId(data.promotionCodeId);
            setPromoSummary(data.summary || describeCoupon(data));
            setPromoError('');
        } catch {
            setPromoValidationId('');
            setPromoSummary('');
            setPromoError(pickLocalized(language, 'Promo kodu doğrulanamadı.', 'Could not validate promo code.'));
        } finally {
            setPromoLoading(false);
        }
    };

    const handleCheckout = async (mode: 'premium_monthly' | 'premium_yearly' | 'rapido_pack') => {
        if (!user) {
            alert(pickLocalized(language, 'Lütfen önce giriş yapın.', 'Please sign in first.'));
            return;
        }
        setLoading(true);
        try {
            const jwt = await account.createJWT();
            const res = await fetch('/api/checkout', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt.jwt}`,
                },
                body: JSON.stringify({
                    mode,
                    quantity: mode === 'rapido_pack' ? rapidoQty : undefined,
                    promoCode: promoCode.trim() || undefined,
                    promotionCodeId: promoValidationId || undefined,
                }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                if (data.code === 'INVALID_PROMO_CODE') {
                    setPromoValidationId('');
                    setPromoSummary('');
                    setPromoError(
                        data.error || pickLocalized(language, 'Promo kodu geçersiz.', 'Invalid promo code.'),
                    );
                }
                alert(
                    data.error ||
                        pickLocalized(language, 'Ödeme sayfası açılamadı.', 'Could not start checkout.'),
                );
            }
        } catch {
            alert(pickLocalized(language, 'Bir hata oluştu.', 'Something went wrong.'));
        } finally {
            setLoading(false);
        }
    };

    const premiumFeatures = useMemo(
        () => [
            {
                icon: <Users size={18} />,
                title: pickLocalized(language, 'Çoklu Jüri (4 Persona)', 'Multi jury (4 personas)'),
                cost: `${RAPIDO_COSTS.MULTI_JURY} Rapido/${pickLocalized(language, 'analiz', 'analysis')}`,
            },
            {
                icon: <Palette size={18} />,
                title: pickLocalized(language, 'Malzeme Paftası Analizi', 'Material board analysis'),
                cost: `${RAPIDO_COSTS.MATERIAL_BOARD} Rapido/${pickLocalized(language, 'analiz', 'analysis')}`,
            },
            {
                icon: <Shield size={18} />,
                title: pickLocalized(language, 'Jüri Savunma Modu', 'Jury defense mode'),
                cost: `${RAPIDO_COSTS.DEFENSE} Rapido/${pickLocalized(language, 'seans', 'session')}`,
            },
            {
                icon: <Brain size={18} />,
                title: pickLocalized(language, 'AI Mentor (Kişisel)', 'AI Mentor (personal)'),
                cost: pickLocalized(
                    language,
                    'Token bazlı dinamik Rapido tüketimi',
                    'Dynamic Rapido usage (token-based)',
                ),
            },
            {
                icon: <Sparkles size={18} />,
                title: pickLocalized(language, '200 Rapido Başlangıç', '200 Rapido starting balance'),
                cost: pickLocalized(language, 'Hemen kullanıma hazır', 'Ready to use'),
            },
        ],
        [language],
    );

    return (
        <motion.div
            key="premium-upgrade"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-4xl mx-auto"
        >
            <button
                type="button"
                onClick={() => setStep('hero')}
                className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-mono text-xs uppercase tracking-widest mb-8"
            >
                <ArrowLeft size={14} /> {pickLocalized(language, 'Geri Dön', 'Back')}
            </button>

            <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-mono mb-4">
                    <Crown size={14} />
                    <span>{pickLocalized(language, 'PREMIUM & RAPIDO MAĞAZASI', 'PREMIUM & RAPIDO SHOP')}</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight uppercase">
                    {pickLocalized(language, 'Jüriyle ', 'Face the jury at ')}
                    <span className="text-yellow-400">{pickLocalized(language, 'Tam Güç', 'full power')}</span>
                    {language === 'tr' ? ' Yüzleş' : ''}
                </h2>
                {isTrStudent && (
                    <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                        <GraduationCap size={16} className="text-emerald-400" />
                        <span className="text-emerald-400 text-sm font-mono">
                            {isAkdenizStudent
                                ? pickLocalized(
                                    language,
                                    'ogr.akdeniz.edu.tr kampanyası aktif: Premium 149 TL',
                                    'ogr.akdeniz.edu.tr campaign active: Premium 149 TRY',
                                )
                                : pickLocalized(
                                    language,
                                    '.edu.tr e-posta ile öğrenci fiyatlandırması uygulandı',
                                    'Student pricing applied for .edu.tr email',
                                )}
                        </span>
                    </div>
                )}
            </div>

            {/* Tab Switcher */}
            <div className="flex justify-center mb-8">
                <div className="inline-flex bg-black/50 border border-white/10 rounded-full p-1">
                    <button
                        type="button"
                        onClick={() => setTab('premium')}
                        className={`px-6 py-2 rounded-full font-mono text-sm uppercase tracking-wider transition-all ${tab === 'premium' ? 'bg-yellow-500 text-black font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                        Premium
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('rapido')}
                        className={`px-6 py-2 rounded-full font-mono text-sm uppercase tracking-wider transition-all ${tab === 'rapido' ? 'bg-neon-red text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                    >
                        {pickLocalized(language, 'Rapido Satın Al', 'Buy Rapido')}
                    </button>
                </div>
            </div>

            {tab === 'premium' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    {/* Billing Toggle */}
                    <div className="flex justify-center">
                        <div className="inline-flex bg-black/50 border border-white/10 rounded-full p-1">
                            <button
                                type="button"
                                onClick={() => setBilling('monthly')}
                                className={`px-5 py-1.5 rounded-full font-mono text-xs uppercase transition-all ${billing === 'monthly' ? 'bg-white/10 text-white' : 'text-slate-500'}`}
                            >
                                {pickLocalized(language, 'Aylık', 'Monthly')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setBilling('yearly')}
                                className={`px-5 py-1.5 rounded-full font-mono text-xs uppercase transition-all ${billing === 'yearly' ? 'bg-white/10 text-white' : 'text-slate-500'}`}
                            >
                                {pickLocalized(language, 'Yıllık', 'Yearly')}{' '}
                                <span className="text-emerald-400 ml-1">-30%</span>
                            </button>
                        </div>
                    </div>

                    {/* Premium Card */}
                    <div className="relative bg-gradient-to-br from-yellow-500/5 to-transparent border border-yellow-500/20 rounded-2xl p-8 overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-8">
                            <div className="flex-1">
                                <h3 className="text-2xl font-display font-bold text-yellow-400 uppercase mb-2">
                                    Draw or Die Premium
                                </h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    {pickLocalized(
                                        language,
                                        'Tüm jüri modlarına erişim ve 200 Rapido Kalem.',
                                        'Access to all jury modes and 200 Rapido pens.',
                                    )}
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {premiumFeatures.map((f, i) => (
                                        <div key={i} className="flex items-start gap-3 text-sm">
                                            <div className="text-yellow-400 mt-0.5">{f.icon}</div>
                                            <div>
                                                <span className="text-white font-medium">{f.title}</span>
                                                <span className="text-slate-500 text-xs block">{f.cost}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col items-center md:items-end gap-4 min-w-[200px]">
                                <div className="text-right">
                                    <div className="text-4xl font-display font-bold text-white">
                                        {currency}{premiumPrice}
                                    </div>
                                    <div className="text-slate-500 text-xs font-mono">
                                        {billing === 'monthly'
                                            ? pickLocalized(language, '/ay', '/mo')
                                            : pickLocalized(language, '/yıl', '/yr')}
                                        {monthlyEquiv && (
                                            <span className="block text-emerald-400">
                                                ≈ {currency}
                                                {monthlyEquiv}
                                                {pickLocalized(language, '/ay', '/mo')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="w-full space-y-2">
                                    <label className="block text-left text-[10px] font-mono uppercase tracking-wider text-slate-400">
                                        {pickLocalized(language, 'Promo Kodu', 'Promo code')}
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={promoCode}
                                            onChange={(event) => {
                                                const next = event.target.value.toUpperCase();
                                                setPromoCode(next);
                                                setPromoValidationId('');
                                                setPromoSummary('');
                                                if (promoError) setPromoError('');
                                            }}
                                            placeholder={pickLocalized(language, 'ÖRN: STUDIO20', 'E.G. STUDIO20')}
                                            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-yellow-400"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleValidatePromo}
                                            disabled={promoLoading || !promoCode.trim()}
                                            className="px-3 py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 text-[10px] font-mono uppercase tracking-wider hover:bg-yellow-500/20 disabled:opacity-45"
                                        >
                                            {promoLoading
                                                ? pickLocalized(language, 'Kontrol...', 'Checking...')
                                                : pickLocalized(language, 'Doğrula', 'Validate')}
                                        </button>
                                    </div>
                                    {promoSummary && <p className="text-[10px] font-mono text-emerald-300">{promoSummary}</p>}
                                    {promoError && <p className="text-[10px] font-mono text-red-300">{promoError}</p>}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleCheckout(billing === 'monthly' ? 'premium_monthly' : 'premium_yearly')}
                                    disabled={loading || (profile?.is_premium ?? false)}
                                    className="w-full px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold font-mono uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {profile?.is_premium
                                        ? pickLocalized(language, 'Zaten Premium', 'Already Premium')
                                        : loading
                                            ? pickLocalized(language, 'Yönlendiriliyor...', 'Redirecting...')
                                            : pickLocalized(language, 'Premium Ol', 'Get Premium')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <EduVerificationCard
                        eduVerified={Boolean(profile?.edu_verified)}
                        verifiedEduEmail={profile?.edu_email ?? null}
                        pendingEduEmail={profile?.edu_verification_email ?? null}
                        onVerified={refreshProfile}
                    />

                    {/* P0.2: Feature Comparison Matrix */}
                    <div className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-white/5">
                            <h3 className="text-lg font-display font-bold text-white uppercase mb-2">
                                {pickLocalized(language, 'Özellik Karşılaştırması', 'Feature comparison')}
                            </h3>
                            <p className="text-slate-400 text-sm">
                                {pickLocalized(language, 'Hangi modlar hangi plana dahil?', 'Which modes are included in each plan?')}
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-white/5">
                                        <th className="px-6 py-3 text-left font-mono text-slate-400 text-xs uppercase">
                                            {pickLocalized(language, 'Özellik', 'Feature')}
                                        </th>
                                        <th className="px-6 py-3 text-center font-mono text-slate-400 text-xs uppercase">
                                            {pickLocalized(language, 'Kayıtsız', 'Guest')}
                                        </th>
                                        <th className="px-6 py-3 text-center font-mono text-slate-400 text-xs uppercase">
                                            {pickLocalized(language, 'Kayıtlı', 'Registered')}
                                        </th>
                                        <th className="px-6 py-3 text-center font-mono text-slate-400 text-xs uppercase">Premium</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    <tr>
                                        <td className="px-6 py-3 font-mono text-white">
                                            {pickLocalized(language, 'Tekli Jüri Analizi', 'Single-jury analysis')}
                                        </td>
                                        <td className="px-6 py-3 text-center text-emerald-400">
                                            {pickLocalized(language, '1 deneme', '1 trial')}
                                        </td>
                                        <td className="px-6 py-3 text-center text-emerald-400">✓</td>
                                        <td className="px-6 py-3 text-center text-emerald-400">✓</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 font-mono text-white">
                                            {pickLocalized(language, 'Analiz Uzunluğu', 'Analysis length')}
                                        </td>
                                        <td className="px-6 py-3 text-center text-slate-500">
                                            {pickLocalized(language, 'Kısa', 'Short')}
                                        </td>
                                        <td className="px-6 py-3 text-center text-emerald-400">
                                            {pickLocalized(language, 'Kısa + Orta', 'Short + medium')}
                                        </td>
                                        <td className="px-6 py-3 text-center text-emerald-400">
                                            {pickLocalized(language, 'Kısa + Orta + Uzun', 'Short + medium + long')}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 font-mono text-white">
                                            {pickLocalized(language, 'Tasarımları Kaydet / Geçmiş', 'Save designs / history')}
                                        </td>
                                        <td className="px-6 py-3 text-center text-slate-500">✗</td>
                                        <td className="px-6 py-3 text-center text-emerald-400">✓</td>
                                        <td className="px-6 py-3 text-center text-emerald-400">✓</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 font-mono text-white">
                                            {pickLocalized(language, 'Çoklu Jüri (4 Persona)', 'Multi jury (4 personas)')}
                                        </td>
                                        <td className="px-6 py-3 text-center text-slate-500">✗</td>
                                        <td className="px-6 py-3 text-center text-slate-500">✗</td>
                                        <td className="px-6 py-3 text-center text-emerald-400">✓</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 font-mono text-white">
                                            {pickLocalized(language, 'Jüri Savunması', 'Jury defense')}
                                        </td>
                                        <td className="px-6 py-3 text-center text-slate-500">✗</td>
                                        <td className="px-6 py-3 text-center text-slate-500">✗</td>
                                        <td className="px-6 py-3 text-center text-emerald-400">✓</td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 font-mono text-white">AI Mentor</td>
                                        <td className="px-6 py-3 text-center text-slate-500">✗</td>
                                        <td className="px-6 py-3 text-center text-emerald-400">
                                            {pickLocalized(language, '6000 token/sohbet', '6000 tokens/chat')}
                                        </td>
                                        <td className="px-6 py-3 text-center text-emerald-400">
                                            {pickLocalized(language, '12000 token/sohbet', '12000 tokens/chat')}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="px-6 py-3 font-mono text-white">
                                            {pickLocalized(language, 'Başlangıç Rapido', 'Starting Rapido')}
                                        </td>
                                        <td className="px-6 py-3 text-center text-slate-500">2</td>
                                        <td className="px-6 py-3 text-center text-emerald-400">15</td>
                                        <td className="px-6 py-3 text-center text-emerald-400">200</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>
            )}

            {tab === 'rapido' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <div className="relative bg-gradient-to-br from-red-500/5 to-transparent border border-white/10 rounded-2xl p-8 overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                        <div className="relative">
                            <div className="flex items-center gap-3 mb-6">
                                <PenTool size={24} className="text-neon-red" />
                                <div>
                                    <h3 className="text-2xl font-display font-bold text-white uppercase">
                                        {pickLocalized(language, 'Rapido Kalem Paketi', 'Rapido pen pack')}
                                    </h3>
                                    <p className="text-slate-400 text-sm">
                                        {pickLocalized(
                                            language,
                                            'Her analiz Rapido harcar. Stokunu yenile.',
                                            'Each analysis spends Rapido. Top up your balance.',
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-slate-400 text-sm font-mono">
                                    {pickLocalized(language, 'Miktar:', 'Quantity:')}
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setRapidoQty(Math.max(STRIPE_PRICES.MIN_RAPIDO_PURCHASE, rapidoQty - 5))}
                                        className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
                                    >
                                        -
                                    </button>
                                    <div className="w-20 text-center">
                                        <span className="text-2xl font-display font-bold text-white">{rapidoQty}</span>
                                        <span className="text-slate-500 text-xs block">Rapido</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setRapidoQty(rapidoQty + 5)}
                                        className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl px-6 py-4 mb-6">
                                <div className="text-slate-400 text-sm font-mono">
                                    {rapidoQty} × {currency}{rapidoUnitPrice}
                                </div>
                                <div className="text-3xl font-display font-bold text-white">
                                    {currency}{rapidoTotal}
                                </div>
                            </div>

                            {/* Quick presets */}
                            <div className="flex flex-wrap gap-2 mb-6">
                                {[5, 10, 25, 50, 100].map((qty) => (
                                    <button
                                        type="button"
                                        key={qty}
                                        onClick={() => setRapidoQty(qty)}
                                        className={`px-4 py-2 rounded-lg font-mono text-xs uppercase transition-all ${rapidoQty === qty ? 'bg-neon-red text-white' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white'}`}
                                    >
                                        {qty} Rapido
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => handleCheckout('rapido_pack')}
                                disabled={loading}
                                className="w-full px-8 py-3 bg-neon-red hover:bg-[#cc0029] text-white font-bold font-mono uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading
                                    ? pickLocalized(language, 'Yönlendiriliyor...', 'Redirecting...')
                                    : pickLocalized(language, `${rapidoQty} Rapido Satın Al`, `Buy ${rapidoQty} Rapido`)}
                            </button>

                            {/* Current balance indicator */}
                            {profile && (
                                <div className="mt-4 text-center text-slate-500 text-xs font-mono">
                                    {pickLocalized(language, 'Mevcut bakiye:', 'Current balance:')}{' '}
                                    {profile.rapido_pens} Rapido
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cost reference */}
                    <div className="bg-black/30 border border-white/5 rounded-xl p-6">
                        <h4 className="text-sm font-mono uppercase tracking-wider text-slate-500 mb-4">
                            {pickLocalized(language, 'Rapido Harcama Tablosu', 'Rapido spend reference')}
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {Object.entries(RAPIDO_COSTS).map(([key, cost]) => (
                                <div key={key} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                                    <span className="text-xs text-slate-400">{rapidoCostOperationLabel(key, language)}</span>
                                    <span className="text-xs font-bold text-white">{cost} <PenTool size={10} className="inline text-neon-red" /></span>
                                </div>
                            ))}
                        </div>
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
