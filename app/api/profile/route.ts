import { NextRequest, NextResponse } from 'next/server';
import {
  APPWRITE_SERVER_API_KEY,
  getAuthenticatedUserFromRequest,
  getReferralSignupCountByCode,
  getOrCreateProfile,
  updateProfileById,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { logServerError } from '@/lib/logger';
import { normalizeLanguage } from '@/lib/i18n';

function isAppwriteServerUnavailable(): boolean {
  return !APPWRITE_SERVER_API_KEY.trim();
}

export async function GET(request: NextRequest) {
  try {
    if (isAppwriteServerUnavailable()) {
      return NextResponse.json(
        { error: 'Profil servisi şu anda kullanılamıyor.' },
        { status: 503 },
      );
    }

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();
    const profile = await getOrCreateProfile(user);
    const referralSignupCount = profile.referral_code
      ? await getReferralSignupCountByCode(profile.referral_code)
      : 0;

    return NextResponse.json({
      profile: {
        ...profile,
        referral_signup_count: referralSignupCount,
      },
    });
  } catch (error) {
    logServerError('api.profile.GET', error);
    return NextResponse.json({ error: 'Profil alınamadı.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (isAppwriteServerUnavailable()) {
      return NextResponse.json(
        { error: 'Profil servisi şu anda kullanılamıyor.' },
        { status: 503 },
      );
    }

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const hasLanguageInput = Object.prototype.hasOwnProperty.call(payload, 'preferred_language')
      || Object.prototype.hasOwnProperty.call(payload, 'language');

    if (!hasLanguageInput) {
      return NextResponse.json({ error: 'Güncellenecek alan bulunamadı.' }, { status: 400 });
    }

    const preferredLanguage = normalizeLanguage(payload.preferred_language ?? payload.language, 'tr');

    await updateProfileById(user.id, {
      preferred_language: preferredLanguage,
    });

    const profile = await getOrCreateProfile(user);
    return NextResponse.json({ profile });
  } catch (error) {
    logServerError('api.profile.PATCH', error);
    return NextResponse.json({ error: 'Profil güncellenemedi.' }, { status: 500 });
  }
}
