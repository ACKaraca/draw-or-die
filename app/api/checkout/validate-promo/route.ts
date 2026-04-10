import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { getAuthenticatedUserFromRequest, getOrCreateProfile } from '@/lib/appwrite/server';
import { ensureCommerceAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { validatePromoForCheckout } from '@/lib/promo-codes';

let _stripe: Stripe | null = null;

function getStripe() {
  if (!_stripe) {
    const raw = process.env.STRIPE_SECRET_KEY;
    if (!raw) {
      throw new Error('MISSING_STRIPE_SECRET_KEY');
    }

    const stripeSecretKey = raw.replace(/[\r\n\s"']/g, '').trim();
    if (!stripeSecretKey) {
      throw new Error('MISSING_STRIPE_SECRET_KEY');
    }

    _stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-02-25.clover',
    });
  }

  return _stripe;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giris yapmaniz gerekiyor.' }, { status: 401 });
    }

    await ensureCommerceAppwriteResources();

    const rl = await checkRateLimit(`checkout:promo:${user.id}`, RATE_LIMITS.CHECKOUT);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Cok fazla istek. Lutfen bekleyin.' }, { status: 429 });
    }

    const body = (await request.json()) as { code?: unknown; mode?: unknown };
    const code = typeof body.code === 'string' ? body.code.trim().substring(0, 64) : '';
    const mode = body.mode === 'rapido_pack' || body.mode === 'premium_yearly'
      ? body.mode
      : 'premium_monthly';

    if (!code) {
      return NextResponse.json({ valid: false, error: 'Promo kodu gerekli.', code: 'PROMO_REQUIRED' }, { status: 400 });
    }

    const profile = await getOrCreateProfile(user);
    const internal = await validatePromoForCheckout({
      code,
      user,
      profile,
      mode,
    });

    if (internal.valid && internal.source === 'internal') {
      return NextResponse.json(internal);
    }

    if (!internal.valid && internal.code !== 'PROMO_NOT_FOUND') {
      return NextResponse.json(
        {
          valid: false,
          error: internal.error,
          code: internal.code,
        },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const list = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    });

    const promo = list.data.find((entry) => entry.active);
    if (!promo) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Promo kodu gecersiz veya suresi dolmus.',
          code: 'INVALID_PROMO_CODE',
        },
        { status: 404 },
      );
    }

    const couponRaw = promo.promotion?.coupon;
    const coupon = couponRaw && typeof couponRaw === 'object' ? couponRaw : null;

    return NextResponse.json({
      valid: true,
      source: 'stripe',
      promotionCodeId: promo.id,
      promoCode: promo.code,
      coupon: {
        id: coupon?.id ?? null,
        name: coupon?.name ?? null,
        duration: coupon?.duration ?? null,
        percentOff: coupon?.percent_off ?? null,
        amountOff: coupon?.amount_off ?? null,
        currency: coupon?.currency ?? null,
      },
    });
  } catch (error) {
    console.error('Validate promo error:', error);

    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Promo kodu su an dogrulanamiyor.',
          code: 'PROMO_VALIDATION_FAILED',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ valid: false, error: 'Promo kodu dogrulanamadi.' }, { status: 500 });
  }
}
