import { NextRequest, NextResponse } from 'next/server';
import { ID, Query } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID,
  APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID,
  APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
  type ArchBuilderExportRow,
  type ArchBuilderFurniturePlacementRow,
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
  buildDrawingFromProgram,
  buildDxfFromDrawing,
  buildSvgPreviewDataUrl,
  type ArchBuilderFurniturePlacement,
} from '@/lib/archbuilder/engine';
import { archBuilderProgramSchema } from '@/lib/archbuilder/schemas';
import { getArchBuilderSessionForUser, getArchBuilderStepOutput } from '@/lib/archbuilder/session-service';
import { getRequestLanguage } from '@/lib/server-i18n';
import { logServerError } from '@/lib/logger';

function resolveRequestedFormats(body: { formats?: unknown }): Array<'DXF' | 'PNG' | 'IFC'> {
  const raw = Array.isArray(body.formats) ? body.formats : ['DXF', 'PNG'];
  const normalized = raw
    .map((value) => String(value).trim().toUpperCase())
    .filter((value) => value === 'DXF' || value === 'PNG' || value === 'IFC') as Array<'DXF' | 'PNG' | 'IFC'>;

  return normalized.length ? Array.from(new Set(normalized)) : ['DXF', 'PNG'];
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

    const programStep = await getArchBuilderStepOutput({
      sessionId,
      stepKey: 'program',
    });

    if (!programStep || !programStep.is_approved) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Önce program adımı üretilip onaylanmalıdır.', 'Program step must be generated and approved first.'),
          code: 'ARCHBUILDER_PROGRAM_NOT_APPROVED',
        },
        { status: 409 },
      );
    }

    const parsedProgram = archBuilderProgramSchema.safeParse(safeJsonParse(programStep.output_json, {}));
    if (!parsedProgram.success) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Program çıktısı çizime dönüştürülemedi.', 'Program output could not be transformed into drawing.'),
          code: 'ARCHBUILDER_PROGRAM_PARSE_FAILED',
        },
        { status: 422 },
      );
    }

    const requestBody = (await request.json().catch(() => ({}))) as {
      formats?: unknown;
      includeFurniture?: unknown;
    };

    const formats = resolveRequestedFormats(requestBody);
    const includeFurniture = requestBody.includeFurniture === true;

    if (formats.includes('IFC') && process.env.FEATURE_ARCHBUILDER_IFC_EXPORT !== 'true') {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'IFC dışa aktarımı şu an kapalıdır.', 'IFC export is currently disabled.'),
          code: 'ARCHBUILDER_IFC_DISABLED',
        },
        { status: 409 },
      );
    }

    const tables = getAdminTables();

    const drawing = buildDrawingFromProgram(parsedProgram.data);

    let furniturePlacements: ArchBuilderFurniturePlacement[] = [];
    if (includeFurniture) {
      const furnitureRows = await tables.listRows<ArchBuilderFurniturePlacementRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID,
        queries: [
          Query.equal('session_id', loaded.session.$id),
          Query.limit(500),
        ],
      });

      furniturePlacements = furnitureRows.rows
        .map((row) => safeJsonParse<ArchBuilderFurniturePlacement | null>(row.placement_json, null))
        .filter((item): item is ArchBuilderFurniturePlacement => Boolean(item));
    }

    const dxf = buildDxfFromDrawing(drawing, furniturePlacements);
    const svgPreview = buildSvgPreviewDataUrl(drawing, furniturePlacements);

    const existingDrawing = await getArchBuilderStepOutput({
      sessionId,
      stepKey: 'drawing',
    });

    if (existingDrawing) {
      await tables.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
        rowId: existingDrawing.$id,
        data: {
          output_json: JSON.stringify(drawing),
          is_approved: false,
        },
      });
    } else {
      await tables.createRow<ArchBuilderStepOutputRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
        rowId: ID.unique(),
        data: {
          project_id: loaded.project.$id,
          session_id: loaded.session.$id,
          user_id: user.id,
          step_key: 'drawing',
          output_json: JSON.stringify(drawing),
          clarifications_json: '[]',
          confidence_score: 74,
          is_approved: false,
        },
      });
    }

    const createdExports: ArchBuilderExportRow[] = [];

    for (const format of formats) {
      const exportPayload =
        format === 'DXF'
          ? {
              drawing,
              furniture: furniturePlacements,
              includeFurniture,
              content: dxf,
            }
          : format === 'PNG'
            ? {
                drawing,
                furniture: furniturePlacements,
                includeFurniture,
                svgDataUrl: svgPreview,
              }
            : {
                drawing,
                furniture: furniturePlacements,
                includeFurniture,
                ifcJson: {
                  disabled: false,
                  note: 'MVP IFC payload placeholder',
                },
              };

      const exportData: {
        project_id: string;
        session_id: string;
        user_id: string;
        export_format: 'DXF' | 'PNG' | 'IFC';
        status: string;
        artifact_url: string;
        preview_url?: string;
        payload_json: string;
        error_code?: string;
        include_furniture: boolean;
      } = {
        project_id: loaded.project.$id,
        session_id: loaded.session.$id,
        user_id: user.id,
        export_format: format,
        status: 'completed',
        artifact_url: `inline://archbuilder/exports/${loaded.session.$id}/${format.toLowerCase()}`,
        payload_json: JSON.stringify(exportPayload),
        include_furniture: includeFurniture,
      };

      if (format === 'PNG') {
        exportData.preview_url = `inline://archbuilder/previews/${loaded.session.$id}`;
      }

      const created = await tables.createRow<ArchBuilderExportRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID,
        rowId: ID.unique(),
        data: exportData,
      });

      createdExports.push(created);
    }

    return NextResponse.json({
      drawing,
      exports: createdExports.map((item) => ({
        id: item.$id,
        format: item.export_format,
        status: item.status,
        artifactUrl: item.artifact_url ?? null,
        previewUrl: item.preview_url ?? null,
        includeFurniture: item.include_furniture,
        createdAt: item.$createdAt,
      })),
    });
  } catch (error) {
    logServerError('api.archbuilder.sessions.id.generate-drawing.POST', error);
    return NextResponse.json(
      { error: localizedArchBuilderMessage(lang, 'Çizim üretimi başarısız oldu.', 'Drawing generation failed.') },
      { status: 500 },
    );
  }
}
