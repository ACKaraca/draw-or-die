import { NextRequest, NextResponse } from 'next/server';
import { ID } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
  APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
  type ArchBuilderStepOutputRow,
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
import {
  ARCHBUILDER_PLANNING_STEPS,
  archBuilderProjectIntentSchema,
  type ArchBuilderPlanningStep,
} from '@/lib/archbuilder/schemas';
import { buildPlanningStepOutput } from '@/lib/archbuilder/engine';
import { getArchBuilderSessionForUser, getArchBuilderStepOutput } from '@/lib/archbuilder/session-service';
import { getRequestLanguage } from '@/lib/server-i18n';
import { logServerError } from '@/lib/logger';

const DEFAULT_LOW_CONFIDENCE_THRESHOLD = 70;

function isKnownPlanningStep(value: string): value is ArchBuilderPlanningStep {
  return (ARCHBUILDER_PLANNING_STEPS as readonly string[]).includes(value);
}

function getLowConfidenceThreshold(): number {
  const raw = Number.parseInt(process.env.ARCHBUILDER_LOW_CONFIDENCE_THRESHOLD ?? '', 10);
  if (!Number.isFinite(raw)) {
    return DEFAULT_LOW_CONFIDENCE_THRESHOLD;
  }

  return Math.min(100, Math.max(0, raw));
}

function isLowConfidence(score: number | null | undefined): boolean {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return false;
  }

  return score < getLowConfidenceThreshold();
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

    const currentStep = loaded.session.current_step;
    if (!isKnownPlanningStep(currentStep)) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Oturum planlama adımı tamamlandı.', 'Planning steps are already complete for this session.'),
          code: 'ARCHBUILDER_PLANNING_COMPLETED',
        },
        { status: 409 },
      );
    }

    const intentRaw = safeJsonParse<unknown>(loaded.project.intent_json, {});
    const parsedIntent = archBuilderProjectIntentSchema.safeParse(intentRaw);
    if (!parsedIntent.success) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Proje girdisi doğrulanamadı.', 'Project intent could not be validated.'),
          code: 'ARCHBUILDER_INTENT_PARSE_FAILED',
        },
        { status: 422 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      clarificationAnswers?: unknown;
    };

    const clarificationAnswers = Array.isArray(body.clarificationAnswers)
      ? body.clarificationAnswers
          .map((item) => (typeof item === 'string' ? item.trim() : String(item).trim()))
          .filter((item) => item.length > 0)
      : [];

    const tables = getAdminTables();

    const existingStepOutput = await getArchBuilderStepOutput({
      sessionId,
      stepKey: currentStep,
    });

    if (existingStepOutput) {
      const existingConfidenceScore = existingStepOutput.confidence_score ?? loaded.session.confidence_score;
      const lowConfidence = isLowConfidence(existingConfidenceScore);
      const clarifications = lowConfidence
        ? safeJsonParse<string[]>(existingStepOutput.clarifications_json, [])
        : [];

      if (
        lowConfidence &&
        clarifications.length > 0 &&
        clarificationAnswers.length > 0 &&
        !existingStepOutput.is_approved
      ) {
        const resolvedConfidenceScore = Math.min(100, Math.round(existingConfidenceScore + 5));

        await tables.updateRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
          rowId: existingStepOutput.$id,
          data: {
            confidence_score: resolvedConfidenceScore,
            clarifications_json: '[]',
          },
        });

        await tables.updateRow({
          databaseId: APPWRITE_DATABASE_ID,
          tableId: APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
          rowId: loaded.session.$id,
          data: {
            confidence_score: resolvedConfidenceScore,
          },
        });

        return NextResponse.json({
          step: currentStep,
          requiresApproval: !existingStepOutput.is_approved,
          requiresClarification: false,
          clarificationLoop: 'resolved',
          clarificationAnswersAccepted: clarificationAnswers.length,
          output: safeJsonParse<Record<string, unknown>>(existingStepOutput.output_json, {}),
          clarifications: [],
          confidenceScore: resolvedConfidenceScore,
        });
      }

      return NextResponse.json({
        step: currentStep,
        requiresApproval: !existingStepOutput.is_approved,
        requiresClarification:
          lowConfidence && clarifications.length > 0 && !existingStepOutput.is_approved,
        clarificationLoop:
          lowConfidence && clarifications.length > 0 && !existingStepOutput.is_approved
            ? 'active'
            : 'none',
        output: safeJsonParse<Record<string, unknown>>(existingStepOutput.output_json, {}),
        clarifications,
        confidenceScore: existingConfidenceScore,
      });
    }

    const computed = buildPlanningStepOutput({
      step: currentStep,
      intent: parsedIntent.data,
      previousOutputs: {},
    });

    const lowConfidence = isLowConfidence(computed.confidenceScore);
    const clarifications = lowConfidence ? computed.clarifications : [];

    let createdOutput: ArchBuilderStepOutputRow;
    try {
      createdOutput = await tables.createRow<ArchBuilderStepOutputRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
        rowId: ID.unique(),
        data: {
          project_id: loaded.project.$id,
          session_id: loaded.session.$id,
          user_id: user.id,
          step_key: currentStep,
          output_json: JSON.stringify(computed.output),
          clarifications_json: JSON.stringify(clarifications),
          confidence_score: computed.confidenceScore,
          is_approved: false,
        },
      });
    } catch {
      const reloaded = await getArchBuilderStepOutput({
        sessionId,
        stepKey: currentStep,
      });

      if (!reloaded) {
        throw new Error('ARCHBUILDER_STEP_OUTPUT_CREATE_FAILED');
      }

      createdOutput = reloaded;
    }

    await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
      rowId: loaded.session.$id,
      data: {
        assumptions_json: JSON.stringify(computed.assumptions),
        confidence_score: computed.confidenceScore,
      },
    });

    return NextResponse.json({
      step: currentStep,
      requiresApproval: true,
      requiresClarification: lowConfidence && clarifications.length > 0,
      clarificationLoop:
        lowConfidence && clarifications.length > 0
          ? 'active'
          : 'none',
      output: safeJsonParse<Record<string, unknown>>(createdOutput.output_json, {}),
      clarifications,
      confidenceScore: createdOutput.confidence_score ?? computed.confidenceScore,
    });
  } catch (error) {
    logServerError('api.archbuilder.sessions.id.orchestrate.POST', error);
    return NextResponse.json(
      { error: localizedArchBuilderMessage(lang, 'ArchBuilder adımı üretilemedi.', 'Failed to orchestrate ArchBuilder step.') },
      { status: 500 },
    );
  }
}
