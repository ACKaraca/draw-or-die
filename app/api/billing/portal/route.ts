import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { getAuthenticatedUserFromRequest, getOrCreateProfile } from '@/lib/appwrite/server';

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
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    const rl = await checkRateLimit(`billing:portal:${user.id}`, RATE_LIMITS.CHECKOUT);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Çok fazla istek. Lütfen bekleyin.' }, { status: 429 });
    }

    await ensureCoreAppwriteResources();
    const profile = await getOrCreateProfile(user);

    if (!profile.stripe_customer_id) {
      return NextResponse.json(
        {
          error: 'Bu hesap icin Stripe musteri kaydi bulunamadi.',
          code: 'NO_STRIPE_CUSTOMER',
        },
        { status: 400 },
      );
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const returnUrl = `${origin.replace(/\/$/, '')}/profile/account`;

    const session = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Billing portal error:', error);

    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return NextResponse.json(
        {
          error: 'Abonelik yönetim bağlantısı oluşturulamadı.',
          code: 'PORTAL_SESSION_FAILED',
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: 'Abonelik yönetim bağlantısı oluşturulamadı.' }, { status: 500 });
  }
}
