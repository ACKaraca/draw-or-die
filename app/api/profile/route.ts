import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
  updateProfileById,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { logServerError } from '@/lib/logger';
import { normalizeLanguage } from '@/lib/i18n';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();
    const profile = await getOrCreateProfile(user);
    return NextResponse.json({ profile });
  } catch (error) {
    logServerError('api.profile.GET', error);
    return NextResponse.json({ error: 'Profil alınamadı.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
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
