import { NextRequest, NextResponse } from 'next/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { getAuthenticatedUserFromRequest } from '@/lib/appwrite/server';
import {
  getArchBuilderAccessForUser,
  isArchBuilderServerUnavailable,
  localizedArchBuilderMessage,
  parseSessionIdFromArchBuilderPath,
  safeJsonParse,
} from '@/lib/archbuilder/api-utils';
import { getArchBuilderSessionForUser, listArchBuilderExports } from '@/lib/archbuilder/session-service';
import { getRequestLanguage } from '@/lib/server-i18n';
import { logServerError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const lang = getRequestLanguage(request);

  try {
    if (isArchBuilderServerUnavailable()) {
      return NextResponse.json(
        { error: localizedArchBuilderMessage(lang, 'ArchBuilder servisi şu anda kullanılamıyor.', 'ArchBuilder service is currently unavailable.') },
        { status: 503 },
      );
    }

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: localizedArchBuilderMessage(lang, 'ArchBuilder için giriş yapmanız gerekiyor.', 'You must sign in to use ArchBuilder.') },
        { status: 401 },
      );
    }

    const sessionId = parseSessionIdFromArchBuilderPath(request.nextUrl.pathname);
    if (!sessionId) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Geçersiz oturum kimliği.', 'Invalid session id.'),
          code: 'ARCHBUILDER_INVALID_SESSION_ID',
        },
        { status: 400 },
      );
    }

    await ensureCoreAppwriteResources();

    const access = await getArchBuilderAccessForUser(user.id);
    if (access !== 'enabled') {
      const notAllowlisted = access === 'not-allowlisted';
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(
            lang,
            notAllowlisted
              ? 'ArchBuilder şu anda hesabınız için aktif değil.'
              : 'ArchBuilder şu anda aktif değil.',
            notAllowlisted
              ? 'ArchBuilder is not currently enabled for your account.'
              : 'ArchBuilder is not enabled yet.',
          ),
          code: notAllowlisted ? 'ARCHBUILDER_NOT_ALLOWLISTED' : 'ARCHBUILDER_DISABLED',
        },
        { status: 403 },
      );
    }

    const loaded = await getArchBuilderSessionForUser({ sessionId, userId: user.id });
    if (!loaded) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'ArchBuilder oturumu bulunamadı.', 'ArchBuilder session was not found.'),
          code: 'ARCHBUILDER_SESSION_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    const exports = await listArchBuilderExports(sessionId);

    return NextResponse.json({
      exports: exports.map((item) => ({
        id: item.$id,
        format: item.export_format,
        status: item.status,
        artifactUrl: item.artifact_url ?? null,
        previewUrl: item.preview_url ?? null,
        includeFurniture: item.include_furniture,
        errorCode: item.error_code ?? null,
        createdAt: item.$createdAt,
        payload: safeJsonParse(item.payload_json, {}),
      })),
    });
  } catch (error) {
    logServerError('api.archbuilder.sessions.id.exports.GET', error);
    return NextResponse.json(
      { error: localizedArchBuilderMessage(lang, 'Dışa aktarımlar alınamadı.', 'Failed to fetch exports.') },
      { status: 500 },
    );
  }
}
