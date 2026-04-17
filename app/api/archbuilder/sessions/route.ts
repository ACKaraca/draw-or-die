import { NextRequest, NextResponse } from 'next/server';
import { ID } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ARCHBUILDER_PROJECTS_ID,
  APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
  type ArchBuilderProjectRow,
  type ArchBuilderSessionRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
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

    const body = (await request.json().catch(() => ({}))) as { projectId?: unknown };
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';

    if (!projectId) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'projectId zorunludur.', 'projectId is required.'),
          code: 'ARCHBUILDER_PROJECT_ID_REQUIRED',
        },
        { status: 400 },
      );
    }

    const tables = getAdminTables();

    let project: ArchBuilderProjectRow;
    try {
      project = await tables.getRow<ArchBuilderProjectRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_PROJECTS_ID,
        rowId: projectId,
      });
    } catch {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Proje bulunamadı.', 'Project was not found.'),
          code: 'ARCHBUILDER_PROJECT_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    if (project.user_id !== user.id) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Bu projeye erişim yetkiniz yok.', 'You do not have access to this project.'),
          code: 'ARCHBUILDER_PROJECT_FORBIDDEN',
        },
        { status: 403 },
      );
    }

    const created = await tables.createRow<ArchBuilderSessionRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
      rowId: ID.unique(),
      data: {
        project_id: project.$id,
        user_id: user.id,
        current_step: 'site',
        approvals_json: '[]',
        assumptions_json: '[]',
        confidence_score: 50,
        status: 'active',
      },
    });

    await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ARCHBUILDER_PROJECTS_ID,
      rowId: project.$id,
      data: {
        latest_session_id: created.$id,
        status: 'active',
      },
    });

    return NextResponse.json({
      session: {
        id: created.$id,
        projectId: created.project_id,
        currentStep: created.current_step,
        confidenceScore: created.confidence_score,
        status: created.status,
        createdAt: created.$createdAt,
      },
    });
  } catch (error) {
    logServerError('api.archbuilder.sessions.POST', error);
    return NextResponse.json(
      { error: localizedArchBuilderMessage(lang, 'ArchBuilder oturumu başlatılamadı.', 'Failed to start ArchBuilder session.') },
      { status: 500 },
    );
  }
}
