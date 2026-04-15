import { NextRequest, NextResponse } from 'next/server';
import { ID, Query } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID,
  APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID,
  APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
  type ArchBuilderExportRow,
  type ArchBuilderFurniturePlacementRow,
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
  buildDxfFromDrawing,
  buildSvgPreviewDataUrl,
  placeFurnitureForDrawing,
} from '@/lib/archbuilder/engine';
import { archBuilderDrawingSchema } from '@/lib/archbuilder/schemas';
import { getArchBuilderSessionForUser, getArchBuilderStepOutput } from '@/lib/archbuilder/session-service';
import { getRequestLanguage } from '@/lib/server-i18n';
import { logServerError } from '@/lib/logger';

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
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

    const drawingStep = await getArchBuilderStepOutput({
      sessionId,
      stepKey: 'drawing',
    });

    if (!drawingStep) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Önce çizim üretilmelidir.', 'Drawing must be generated before furniture placement.'),
          code: 'ARCHBUILDER_DRAWING_REQUIRED',
        },
        { status: 409 },
      );
    }

    const parsedDrawing = archBuilderDrawingSchema.safeParse(safeJsonParse(drawingStep.output_json, {}));
    if (!parsedDrawing.success) {
      return NextResponse.json(
        {
          error: localizedArchBuilderMessage(lang, 'Çizim verisi mobilya yerleşimine uygun değil.', 'Drawing payload is invalid for furniture placement.'),
          code: 'ARCHBUILDER_DRAWING_PARSE_FAILED',
        },
        { status: 422 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      quantities?: {
        table?: number;
        chair?: number;
        flower?: number;
        tree?: number;
      };
    };

    const placements = placeFurnitureForDrawing({
      drawing: parsedDrawing.data,
      quantities: body.quantities,
    });

    const tables = getAdminTables();

    const existing = await tables.listRows<ArchBuilderFurniturePlacementRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID,
      queries: [
        Query.equal('session_id', loaded.session.$id),
        Query.limit(200),
      ],
    });

    for (const row of existing.rows) {
      await tables.deleteRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID,
        rowId: row.$id,
      });
    }

    for (const placement of placements) {
      await tables.createRow<ArchBuilderFurniturePlacementRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID,
        rowId: ID.unique(),
        data: {
          project_id: loaded.project.$id,
          session_id: loaded.session.$id,
          user_id: user.id,
          asset_key: placement.assetKey,
          room_id: placement.roomId,
          quantity: 1,
          placement_json: JSON.stringify(placement),
          collision_score: placement.collisionScore,
        },
      });
    }

    const furnitureStep = await getArchBuilderStepOutput({
      sessionId,
      stepKey: 'furniture',
    });

    if (furnitureStep) {
      await tables.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
        rowId: furnitureStep.$id,
        data: {
          output_json: JSON.stringify({ placements }),
          is_approved: true,
          approved_at: new Date().toISOString(),
          confidence_score: 72,
        },
      });
    } else {
      await tables.createRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
        rowId: ID.unique(),
        data: {
          project_id: loaded.project.$id,
          session_id: loaded.session.$id,
          user_id: user.id,
          step_key: 'furniture',
          output_json: JSON.stringify({ placements }),
          clarifications_json: '[]',
          confidence_score: 72,
          is_approved: true,
          approved_at: new Date().toISOString(),
        },
      });
    }

    const existingExports = await tables.listRows<ArchBuilderExportRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID,
      queries: [
        Query.equal('session_id', loaded.session.$id),
        Query.limit(200),
      ],
    });

    let exportsUpdated = 0;
    for (const exportRow of existingExports.rows) {
      const payload = asRecord(safeJsonParse<unknown>(exportRow.payload_json, {}));

      const nextPayload: Record<string, unknown> = {
        ...payload,
        drawing: parsedDrawing.data,
        furniture: placements,
        includeFurniture: true,
      };

      if (exportRow.export_format === 'DXF') {
        nextPayload.content = buildDxfFromDrawing(parsedDrawing.data, placements);
      } else if (exportRow.export_format === 'PNG') {
        nextPayload.svgDataUrl = buildSvgPreviewDataUrl(parsedDrawing.data, placements);
      } else if (exportRow.export_format === 'IFC') {
        nextPayload.ifcJson = {
          ...asRecord(payload.ifcJson),
          furniture: placements,
          includeFurniture: true,
        };
      }

      await tables.updateRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID,
        rowId: exportRow.$id,
        data: {
          include_furniture: true,
          payload_json: JSON.stringify(nextPayload),
          status: 'completed',
        },
      });

      exportsUpdated += 1;
    }

    return NextResponse.json({
      placements,
      collisions: placements.filter((item) => item.collisionScore > 0).length,
      exportsUpdated,
      includeFurniture: true,
    });
  } catch (error) {
    logServerError('api.archbuilder.sessions.id.place-furniture.POST', error);
    return NextResponse.json(
      { error: localizedArchBuilderMessage(lang, 'Mobilya yerleşimi başarısız oldu.', 'Furniture placement failed.') },
      { status: 500 },
    );
  }
}
