import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { ensureCommerceAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { getAuthenticatedUserFromRequest, getOrCreateProfile } from '@/lib/appwrite/server';
import { redeemPromoCode } from '@/lib/promo-codes';
import { logServerError } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCommerceAppwriteResources();

    const rateLimit = await checkRateLimit(`promo:redeem:${user.id}`, RATE_LIMITS.CHECKOUT);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Çok fazla istek. Lütfen bekleyin.' }, { status: 429 });
    }

    const body = (await request.json()) as { code?: unknown };
    const code = typeof body.code === 'string' ? body.code.trim().substring(0, 64) : '';
    if (!code) {
      return NextResponse.json({ ok: false, error: 'Promo kodu gerekli.', code: 'PROMO_REQUIRED' }, { status: 400 });
    }

    const profile = await getOrCreateProfile(user);
    const result = await redeemPromoCode({ code, user, profile });

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      promoCode: result.promo.code,
      rewardKind: result.promo.rewardKind,
      rewardValue: result.promo.rewardValue,
      rapidoBalance: result.profile.rapido_pens,
      isPremium: result.profile.is_premium,
    });
  } catch (error) {
    logServerError('api.promos.redeem.POST', error);
    return NextResponse.json({ ok: false, error: 'Promo kodu redeem edilemedi.' }, { status: 500 });
  }
}
