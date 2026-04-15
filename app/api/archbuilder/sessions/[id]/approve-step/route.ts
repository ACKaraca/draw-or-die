import { NextRequest, NextResponse } from 'next/server';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
  APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
  getAdminTables,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  getArchBuilderAccessForUser,
  isArchBuilderServerUnavailable,
  localizedArchBuilderMessage,
  parseSessionIdFromArchBuilderPath,
  safeJsonParse,
} from '@/lib/archbuilder/api-utils';
import { ARCHBUILDER_PLANNING_STEPS } from '@/lib/archbuilder/schemas';
import { getArchBuilderSessionForUser, getArchBuilderStepOutput } from '@/lib/archbuilder/session-service';
import { getRequestLanguage } from '@/lib/server-i18n';
import { logServerError } from '@/lib/logger';

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

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

    const body = (await request.json().catch(() => ({}))) as {
      stepKey?: unknown;
      approved?: unknown;
      editedOutput?: unknown;
    };

    const stepKey = typeof body.stepKey === 'string' && body.stepKey.trim()
      ? body.stepKey.trim()
      : loaded.session.current_step;

    if (!(ARCHBUILDER_PLANNING_STEPS as readonly string[]).includes(stepKey)) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Geçersiz adım anahtarı.', 'Invalid step key.'),
          code: 'ARCHBUILDER_INVALID_STEP_KEY',
        },
        { status: 400 },
      );
    }

    const stepOutput = await getArchBuilderStepOutput({ sessionId, stepKey });
    if (!stepOutput) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Onaylanacak adım çıktısı bulunamadı.', 'Step output was not found for approval.'),
          code: 'ARCHBUILDER_STEP_OUTPUT_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    const approved = body.approved === true;
    const outputPayload = body.editedOutput && typeof body.editedOutput === 'object'
      ? body.editedOutput
      : safeJsonParse<Record<string, unknown>>(stepOutput.output_json, {});

    const tables = getAdminTables();

    const stepUpdateData: {
      output_json: string;
      is_approved: boolean;
      approved_at?: string;
    } = {
      output_json: JSON.stringify(outputPayload),
      is_approved: approved,
    };

    if (approved) {
      stepUpdateData.approved_at = new Date().toISOString();
    }

    await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
      rowId: stepOutput.$id,
      data: stepUpdateData,
    });

    if (!approved) {
      return NextResponse.json({
        approved: false,
        step: stepKey,
        currentStep: loaded.session.current_step,
      });
    }

    const previousApprovals = safeJsonParse<string[]>(loaded.session.approvals_json, []);
    const approvals = uniqueValues([...previousApprovals, stepKey]);

    const currentIndex = ARCHBUILDER_PLANNING_STEPS.findIndex((item) => item === stepKey);
    const nextStep = currentIndex >= 0 ? ARCHBUILDER_PLANNING_STEPS[currentIndex + 1] : undefined;

    await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
      rowId: loaded.session.$id,
      data: {
        approvals_json: JSON.stringify(approvals),
        current_step: nextStep ?? stepKey,
        status: nextStep ? 'active' : 'planning_complete',
      },
    });

    return NextResponse.json({
      approved: true,
      step: stepKey,
      currentStep: nextStep ?? stepKey,
      status: nextStep ? 'active' : 'planning_complete',
      approvals,
    });
  } catch (error) {
    logServerError('api.archbuilder.sessions.id.approve-step.POST', error);
    return NextResponse.json(
      { error: localizedArchBuilderMessage(lang, 'Adım onayı kaydedilemedi.', 'Failed to persist step approval.') },
      { status: 500 },
    );
  }
}
