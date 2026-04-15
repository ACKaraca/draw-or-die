import { NextRequest, NextResponse } from 'next/server';
import { ID } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ARCHBUILDER_PROJECTS_ID,
  type ArchBuilderProjectRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { archBuilderProjectIntentSchema } from '@/lib/archbuilder/schemas';
import {
  getArchBuilderAccessForUser,
  isArchBuilderServerUnavailable,
  localizedArchBuilderMessage,
} from '@/lib/archbuilder/api-utils';
import { getRequestLanguage } from '@/lib/server-i18n';
import { logServerError } from '@/lib/logger';

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const parsed = archBuilderProjectIntentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Geçersiz proje girdisi.', 'Invalid project input.'),
          code: 'ARCHBUILDER_INVALID_PROJECT_INTENT',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const intent = parsed.data;
    const tables = getAdminTables();

    const created = await tables.createRow<ArchBuilderProjectRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ARCHBUILDER_PROJECTS_ID,
      rowId: ID.unique(),
      data: {
        user_id: user.id,
        title: intent.title,
        project_type: intent.projectType,
        location: intent.location,
        target_area_m2: Math.round(intent.targetAreaM2),
        intent_json: JSON.stringify(intent),
        constraints_json: JSON.stringify(intent.constraints),
        status: 'active',
      },
    });

    return NextResponse.json({
      project: {
        id: created.$id,
        userId: created.user_id,
        title: created.title,
        projectType: created.project_type,
        location: created.location,
        targetAreaM2: created.target_area_m2,
        status: created.status,
        intent,
        createdAt: created.$createdAt,
      },
    });
  } catch (error) {
    logServerError('api.archbuilder.projects.POST', error);
    return NextResponse.json(
      { error: localizedArchBuilderMessage(lang, 'ArchBuilder projesi oluşturulamadı.', 'Failed to create ArchBuilder project.') },
      { status: 500 },
    );
  }
}
