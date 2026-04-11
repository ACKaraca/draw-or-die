import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
  getReferralSignupCountByCode,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { linkReferralToUser } from '@/lib/referral';
import { logServerError } from '@/lib/logger';

const REFERRAL_BASE_URL = (process.env.NEXT_PUBLIC_REFERRAL_BASE_URL ?? 'https://drawordie.app').replace(/\/$/, '');

// GET /api/referral/link
// Returns the authenticated user's shareable referral link and referral signup count.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const profile = await getOrCreateProfile(user);
    const referralCode = profile.referral_code;
    const referralSignupCount = referralCode
      ? await getReferralSignupCountByCode(referralCode)
      : 0;

    return NextResponse.json({
      referral_code: referralCode,
      referral_link: referralCode ? `${REFERRAL_BASE_URL}/?ref=${referralCode}` : null,
      referral_signup_count: referralSignupCount,
    });
  } catch (error) {
    logServerError('api.referral.link.GET', error);
    return NextResponse.json({ error: 'Referral linki alınamadı.' }, { status: 500 });
  }
}

// POST /api/referral/link
// Yeni kayıt olan kullanıcının profiline referral kodu bağlar.
// Çağrı: kayıt sonrası, email doğrulanmadan önce.
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({})) as { referral_code?: unknown };
    const code = typeof body.referral_code === 'string' ? body.referral_code.trim() : '';

    if (!code) {
      return NextResponse.json({ error: 'Referral kodu gerekli.' }, { status: 400 });
    }

    await ensureCoreAppwriteResources();

    const result = await linkReferralToUser(user.id, code);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logServerError('api.referral.link.POST', error);
    return NextResponse.json({ error: 'Referral kodu bağlanamadı.' }, { status: 500 });
  }
}
