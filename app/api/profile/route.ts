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
import { getRequestLanguage } from '@/lib/server-i18n';
import { ApiMessages } from '@/lib/locales/apiMessages';

function isAppwriteServerUnavailable(): boolean {
  return !APPWRITE_SERVER_API_KEY.trim();
}

export async function GET(request: NextRequest) {
  const lang = getRequestLanguage(request);
  try {
    if (isAppwriteServerUnavailable()) {
      return NextResponse.json(
        { error: ApiMessages.profileUnavailable(lang) },
        { status: 503 },
      );
    }

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: ApiMessages.signInRequired(lang) }, { status: 401 });
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
    return NextResponse.json({ error: ApiMessages.profileFetchFailed(lang) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const lang = getRequestLanguage(request);
  try {
    if (isAppwriteServerUnavailable()) {
      return NextResponse.json(
        { error: ApiMessages.profileUnavailable(lang) },
        { status: 503 },
      );
    }

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: ApiMessages.signInRequired(lang) }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: ApiMessages.invalidBody(lang) }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const hasLanguageInput = Object.prototype.hasOwnProperty.call(payload, 'preferred_language')
      || Object.prototype.hasOwnProperty.call(payload, 'language');

    if (!hasLanguageInput) {
      return NextResponse.json({ error: ApiMessages.noFieldsToUpdate(lang) }, { status: 400 });
    }

    const preferredLanguage = normalizeLanguage(payload.preferred_language ?? payload.language, 'tr');

    await updateProfileById(user.id, {
      preferred_language: preferredLanguage,
    });

    const profile = await getOrCreateProfile(user);
    return NextResponse.json({ profile });
  } catch (error) {
    logServerError('api.profile.PATCH', error);
    return NextResponse.json({ error: ApiMessages.profileUpdateFailed(lang) }, { status: 500 });
  }
}
