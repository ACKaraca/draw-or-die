import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { STRIPE_PRICES, StripeTierKey, resolveStripeTierForUser } from '@/lib/pricing';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getAuthenticatedUserFromRequest, getOrCreateProfile, getVerifiedEmail } from '@/lib/appwrite/server';
import { ensureCommerceAppwriteResources, ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { releaseCheckoutPromoReservation, reserveCheckoutPromo, validatePromoForCheckout } from '@/lib/promo-codes';
import { logServerError } from '@/lib/logger';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';

const MAX_RAPIDO_PURCHASE = STRIPE_PRICES.MAX_RAPIDO_PURCHASE;
// Checkout sessions holding an internal promo reservation expire sooner to free the slot.
const PROMO_SESSION_TTL_SECONDS = 60 * 60;
const BLOCKING_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);

function readCleanEnv(name: string): string {
    const raw = process.env[name];
    if (typeof raw !== 'string') return '';

    const value = raw.trim();
    if (!value) return '';

    return /[\r\n\0]/.test(value) ? '' : value;
}

function parseAllowedOrigin(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed || /[\r\n\0]/.test(trimmed)) return null;

    try {
        const url = new URL(trimmed);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return null;
        }
        return url.origin;
    } catch {
        return null;
    }
}

function resolveSafeOrigin(originHeader: string | null, fallbackRaw: string): string {
    const fallback = parseAllowedOrigin(fallbackRaw) ?? 'http://localhost:3000';
    return parseAllowedOrigin(originHeader ?? '') ?? fallback;
}

let _stripe: Stripe | null = null;
function getStripe() {
    if (!_stripe) {
        const stripeSecretKey = readCleanEnv('STRIPE_SECRET_KEY');
        if (!stripeSecretKey) {
            throw new Error('MISSING_STRIPE_SECRET_KEY');
        }

        _stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2026-02-25.clover',
        });
    }
    return _stripe;
}

type CheckoutMode = 'premium_monthly' | 'premium_yearly' | 'rapido_pack';

interface CheckoutBody {
    mode: CheckoutMode;
    quantity?: number; // only for rapido_pack
    promoCode?: string;
    promotionCodeId?: string;
}

type StripeTierConfig =
    typeof STRIPE_PRICES.AKDENIZ_STUDENT |
    typeof STRIPE_PRICES.TR_STUDENT |
    typeof STRIPE_PRICES.GLOBAL;

function getTierConfig(key: StripeTierKey): StripeTierConfig {
    return STRIPE_PRICES[key];
}

function buildSubscriptionLineItem(
    tier: StripeTierConfig,
    cycle: 'monthly' | 'yearly'
): Stripe.Checkout.SessionCreateParams.LineItem {
    const priceId = cycle === 'monthly' ? tier.PRICE_IDS.MONTHLY : tier.PRICE_IDS.YEARLY;
    if (priceId) {
        return {
            price: priceId,
            quantity: 1,
        };
    }

    return {
        price_data: {
            currency: tier.CURRENCY,
            unit_amount: cycle === 'monthly' ? tier.MONTHLY : tier.YEARLY,
            recurring: {
                interval: cycle === 'monthly' ? 'month' : 'year',
            },
            product: tier.PRODUCT_ID,
        },
        quantity: 1,
    };
}

function buildRapidoLineItem(
    tier: StripeTierConfig,
    quantity: number
): Stripe.Checkout.SessionCreateParams.LineItem {
    if (tier.PRICE_IDS.RAPIDO) {
        return {
            price: tier.PRICE_IDS.RAPIDO,
            quantity,
        };
    }

    return {
        price_data: {
            currency: tier.CURRENCY,
            unit_amount: tier.RAPIDO_UNIT,
            product: STRIPE_PRICES.RAPIDO_PRODUCT_ID,
        },
        quantity,
    };
}

async function resolvePromotionCode(
    stripe: Stripe,
    promoCodeRaw: unknown,
    promotionCodeIdRaw: unknown,
): Promise<{ id: string; code: string } | null> {
    const promotionCodeId = typeof promotionCodeIdRaw === 'string'
        ? promotionCodeIdRaw.trim().substring(0, 128)
        : '';

    if (promotionCodeId) {
        try {
            const promo = await stripe.promotionCodes.retrieve(promotionCodeId);
            if (!promo.active) {
                throw new Error('INACTIVE_PROMO_CODE');
            }

            return {
                id: promo.id,
                code: (promo.code || '').trim(),
            };
        } catch {
            throw new Error('INVALID_PROMO_CODE');
        }
    }

    const promoCode = typeof promoCodeRaw === 'string'
        ? promoCodeRaw.trim().substring(0, 64)
        : '';

    if (!promoCode) {
        return null;
    }

    try {
        const list = await stripe.promotionCodes.list({
            code: promoCode,
            active: true,
            limit: 1,
        });

        const promo = list.data.find((entry) => entry.active);
        if (!promo) {
            throw new Error('INVALID_PROMO_CODE');
        }

        return {
            id: promo.id,
            code: (promo.code || promoCode).trim(),
        };
    } catch {
        throw new Error('INVALID_PROMO_CODE');
    }
}

/** Missing quantity falls back to the minimum pack; anything else must be an in-range integer. */
function resolveRapidoQuantity(raw: unknown): number | null {
    if (raw === undefined || raw === null) {
        return STRIPE_PRICES.MIN_RAPIDO_PURCHASE;
    }

    if (
        typeof raw !== 'number' ||
        !Number.isInteger(raw) ||
        raw < STRIPE_PRICES.MIN_RAPIDO_PURCHASE ||
        raw > MAX_RAPIDO_PURCHASE
    ) {
        return null;
    }

    return raw;
}

/**
 * True when the customer already has a subscription that would make a second one a
 * duplicate. The Stripe customer is the source of truth; the profile is a fast pre-check.
 */
async function hasBlockingSubscription(
    stripe: Stripe,
    profile: { stripe_customer_id: string | null; stripe_subscription_id: string | null; subscription_status: string | null; is_premium: boolean },
): Promise<boolean> {
    if (
        profile.is_premium &&
        profile.stripe_subscription_id &&
        BLOCKING_SUBSCRIPTION_STATUSES.has(profile.subscription_status ?? '')
    ) {
        return true;
    }

    if (!profile.stripe_customer_id) return false;
    const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: 'all',
        limit: 20,
    });
    return subscriptions.data.some((subscription) => BLOCKING_SUBSCRIPTION_STATUSES.has(subscription.status));
}

function applyDiscountToAmount(amountCents: number, promo: { rewardKind: string; rewardValue: number }): number {
    if (promo.rewardKind === 'discount_percent') {
        const percent = Math.max(0, Math.min(100, Math.trunc(promo.rewardValue)));
        return Math.max(0, Math.floor(amountCents - (amountCents * percent / 100)));
    }

    if (promo.rewardKind === 'discount_amount') {
        return Math.max(0, amountCents - Math.max(0, Math.trunc(promo.rewardValue)));
    }

    return amountCents;
}

export async function POST(request: NextRequest) {
    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json(
                { error: 'Stripe yapılandırması eksik. Lütfen destekle iletişime geçin.' },
                { status: 503 }
            );
        }

        const user = await getAuthenticatedUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
        }

        // Rate limit per user
        const rl = await checkRateLimit(`checkout:${user.id}`, RATE_LIMITS.CHECKOUT);
        if (!rl.allowed) {
            return NextResponse.json({ error: 'Çok fazla istek. Lütfen bekleyin.' }, { status: 429 });
        }

        const body: CheckoutBody = await request.json();
        const { mode, quantity, promoCode, promotionCodeId } = body;
        const normalizedPromoCode = typeof promoCode === 'string' ? promoCode.trim().substring(0, 64) : '';

        if (!mode || !['premium_monthly', 'premium_yearly', 'rapido_pack'].includes(mode)) {
            return NextResponse.json({ error: 'Geçersiz checkout modu.' }, { status: 400 });
        }

        const rapidoQuantity = mode === 'rapido_pack' ? resolveRapidoQuantity(quantity) : 0;
        if (rapidoQuantity === null) {
            const lang = getRequestLanguage(request);
            const min = STRIPE_PRICES.MIN_RAPIDO_PURCHASE;
            return NextResponse.json(
                {
                    error: pickLocalized(
                        lang,
                        `Rapido adedi ${min} ile ${MAX_RAPIDO_PURCHASE} arasında bir tam sayı olmalıdır.`,
                        `Rapido quantity must be a whole number between ${min} and ${MAX_RAPIDO_PURCHASE}.`,
                    ),
                    code: 'INVALID_RAPIDO_QUANTITY',
                },
                { status: 400 },
            );
        }

        if (normalizedPromoCode) {
            await ensureCommerceAppwriteResources();
        } else {
            await ensureCoreAppwriteResources();
        }

        // Determine pricing tier based on verified edu email (if available)
        const profile = await getOrCreateProfile(user);
        // Student pricing from the signup email only once that email is verified.
        const tierKey = resolveStripeTierForUser({
            primaryEmail: getVerifiedEmail(user),
            eduVerified: profile.edu_verified,
            eduEmail: profile.edu_email,
        });
        const tier = getTierConfig(tierKey);
        const stripe = getStripe();

        if (mode !== 'rapido_pack' && await hasBlockingSubscription(stripe, profile)) {
            const lang = getRequestLanguage(request);
            return NextResponse.json(
                {
                    error: pickLocalized(
                        lang,
                        'Zaten aktif bir aboneliğin var. Planını abonelik yönetiminden değiştirebilirsin.',
                        'You already have an active subscription. Manage your plan from the billing portal.',
                    ),
                    code: 'SUBSCRIPTION_ALREADY_ACTIVE',
                },
                { status: 409 },
            );
        }
        const internalPromo = normalizedPromoCode
            ? await validatePromoForCheckout({
                code: normalizedPromoCode,
                user,
                profile,
                mode,
            })
            : null;

        if (internalPromo && !internalPromo.valid && internalPromo.code !== 'PROMO_NOT_FOUND') {
            return NextResponse.json(
                { error: internalPromo.error, code: internalPromo.code },
                { status: 400 },
            );
        }

        const internalDiscount = internalPromo?.valid && internalPromo.source === 'internal'
            ? internalPromo.promo
            : null;
        // An internal promo is applied via custom line-item pricing; Stripe does not know the code.
        const resolvedPromotionCode = internalDiscount
            ? null
            : await resolvePromotionCode(stripe, normalizedPromoCode, promotionCodeId);

        let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
        let checkoutMode: Stripe.Checkout.SessionCreateParams.Mode;
        let expectedUnitAmount = '';

        if (mode === 'rapido_pack') {
            if (internalDiscount) {
                const unitAmount = applyDiscountToAmount(tier.RAPIDO_UNIT, internalDiscount);
                expectedUnitAmount = String(unitAmount);
                lineItems = [{
                    price_data: {
                        currency: tier.CURRENCY,
                        unit_amount: unitAmount,
                        product: STRIPE_PRICES.RAPIDO_PRODUCT_ID,
                    },
                    quantity: rapidoQuantity,
                }];
            } else {
                lineItems = [buildRapidoLineItem(tier, rapidoQuantity)];
            }
            checkoutMode = 'payment';
        } else {
            const cycle = mode === 'premium_monthly' ? 'monthly' : 'yearly';
            if (internalDiscount) {
                const baseAmount = cycle === 'monthly' ? tier.MONTHLY : tier.YEARLY;
                const discountedAmount = applyDiscountToAmount(baseAmount, internalDiscount);
                expectedUnitAmount = String(discountedAmount);
                lineItems = [{
                    price_data: {
                        currency: tier.CURRENCY,
                        unit_amount: discountedAmount,
                        recurring: {
                            interval: cycle === 'monthly' ? 'month' : 'year',
                        },
                        product: tier.PRODUCT_ID,
                    },
                    quantity: 1,
                }];
            } else {
                lineItems = [buildSubscriptionLineItem(tier, cycle)];
            }
            checkoutMode = 'subscription';
        }

        const origin = resolveSafeOrigin(
            request.headers.get('origin'),
            process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        );

        // Internal promo quota is consumed atomically here and given back if the session
        // expires (checkout.session.expired webhook) or cannot be created.
        let promoReservationId = '';
        if (internalDiscount) {
            const reservation = await reserveCheckoutPromo({ promo: internalDiscount, userId: user.id, mode });
            if (!reservation.ok) {
                return NextResponse.json({ error: reservation.error, code: reservation.code }, { status: 400 });
            }
            promoReservationId = reservation.reservation.reservationId;
        }

        let session: Stripe.Checkout.Session;
        try {
            session = await stripe.checkout.sessions.create({
                // Reuse the known Stripe customer so subscriptions and payments stay on one record.
                ...(profile.stripe_customer_id
                    ? { customer: profile.stripe_customer_id }
                    : { customer_email: user.email || undefined }),
                client_reference_id: user.id,
                mode: checkoutMode,
                line_items: lineItems,
                ...(resolvedPromotionCode ? { discounts: [{ promotion_code: resolvedPromotionCode.id }] } : {}),
                allow_promotion_codes: !resolvedPromotionCode && !internalDiscount,
                ...(promoReservationId
                    ? { expires_at: Math.floor(Date.now() / 1000) + PROMO_SESSION_TTL_SECONDS }
                    : {}),
                // The success page only re-reads the profile; entitlements come from the webhook.
                success_url: `${origin}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${origin}?checkout=cancelled`,
                metadata: {
                    user_id: user.id,
                    checkout_mode: mode,
                    rapido_quantity: mode === 'rapido_pack' ? String(rapidoQuantity) : '0',
                    pricing_tier: tierKey,
                    pricing_email_source: profile.edu_verified && profile.edu_email ? 'edu_verified_email' : 'primary_email',
                    promo_code: internalDiscount?.code || resolvedPromotionCode?.code || '',
                    promotion_code_id: internalDiscount?.id || resolvedPromotionCode?.id || '',
                    promo_source: internalDiscount ? 'internal' : (resolvedPromotionCode ? 'stripe' : ''),
                    promo_reservation_id: promoReservationId,
                    expected_unit_amount: expectedUnitAmount,
                },
            });
        } catch (error) {
            if (promoReservationId) {
                try {
                    await releaseCheckoutPromoReservation(promoReservationId);
                } catch (releaseError) {
                    logServerError('checkout.promo-release', releaseError, { promoReservationId });
                }
            }
            throw error;
        }

        return NextResponse.json({ url: session.url });
    } catch (error) {
        console.error('Checkout error:', error);

        if (error instanceof Error && error.message === 'INVALID_PROMO_CODE') {
            return NextResponse.json(
                {
                    error: 'Promo kodu gecersiz veya suresi dolmus.',
                    code: 'INVALID_PROMO_CODE',
                },
                { status: 400 },
            );
        }

        if (error instanceof Stripe.errors.StripeInvalidRequestError) {
            return NextResponse.json(
                { error: 'Stripe fiyat konfigürasyonu geçersiz. Yönetici ile iletişime geçin.' },
                { status: 503 }
            );
        }

        return NextResponse.json({ error: 'Checkout oluşturulamadı.' }, { status: 500 });
    }
}
