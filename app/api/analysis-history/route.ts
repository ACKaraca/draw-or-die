import { NextRequest, NextResponse } from 'next/server';
import { ID, Query } from 'node-appwrite';
import type { Models } from 'node-appwrite';
import {
  APPWRITE_BUCKET_GALLERY_ID,
  APPWRITE_DATABASE_ID,
  APPWRITE_SERVER_ENDPOINT,
  APPWRITE_SERVER_PROJECT_ID,
  APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
  getOrCreateProfile,
  getAdminStorage,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  updateProfileById,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { getAppwriteErrorDetails } from '@/lib/appwrite/error-utils';
import { logServerError } from '@/lib/logger';
import { normalizeCritiqueText } from '@/lib/critique';
import { invalidateProfileStatsCache } from '@/lib/profile-stats-cache';

const MAX_PAGE_SIZE = 30;
const MAX_SOURCE_UPLOAD_BYTES = 35 * 1024 * 1024;
const ALLOWED_SOURCE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const RAPIDO_PRECISION_SCALE = 100;
const ANALYSIS_PRESERVE_COST_CENTS = 150;
const DELETE_RETENTION_DAYS = 30;

type AnalysisHistoryRow = Models.Row & {
  user_id: string;
  title: string;
  critique: string;
  score?: number;
  gallery_type: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'NONE';
  analysis_kind?: string;
  preview_url: string;
  source_url?: string;
  source_mime?: string;
  is_deleted?: boolean;
  deleted_at?: string;
  purge_after?: string;
};

function buildPreviewFileUrl(fileId: string): string {
  const endpoint = APPWRITE_SERVER_ENDPOINT.replace(/\/$/, '');
  const project = encodeURIComponent(APPWRITE_SERVER_PROJECT_ID);
  return `${endpoint}/storage/buckets/${APPWRITE_BUCKET_GALLERY_ID}/files/${fileId}/preview?project=${project}&width=1280&height=1280&quality=76&output=webp`;
}

function buildSourceFileUrl(fileId: string): string {
  const endpoint = APPWRITE_SERVER_ENDPOINT.replace(/\/$/, '');
  const project = encodeURIComponent(APPWRITE_SERVER_PROJECT_ID);
  return `${endpoint}/storage/buckets/${APPWRITE_BUCKET_GALLERY_ID}/files/${fileId}/view?project=${project}`;
}

function extractFileIdFromUrl(url: string): string | null {
  const match = url.match(/\/files\/([^/]+)\//i);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function toOptimizedPreviewUrl(storedUrl: string): string {
  const fileId = extractFileIdFromUrl(storedUrl);
  if (!fileId) return storedUrl;
  return buildPreviewFileUrl(fileId);
}

function normalizeRapidoFractionCents(value: unknown): number {
  if (!Number.isFinite(value)) return 0;
  const parsed = Math.floor(Number(value));
  if (parsed <= 0) return 0;
  if (parsed >= RAPIDO_PRECISION_SCALE) return RAPIDO_PRECISION_SCALE - 1;
  return parsed;
}

function toRapidoCents(rapidoPens: number, fractionCents: number): number {
  const whole = Number.isFinite(rapidoPens) ? Math.max(0, Math.floor(rapidoPens)) : 0;
  return whole * RAPIDO_PRECISION_SCALE + normalizeRapidoFractionCents(fractionCents);
}

function splitRapidoCents(totalCents: number): { rapidoPens: number; rapidoFractionCents: number } {
  const normalized = Math.max(0, Math.floor(totalCents));
  return {
    rapidoPens: Math.floor(normalized / RAPIDO_PRECISION_SCALE),
    rapidoFractionCents: normalized % RAPIDO_PRECISION_SCALE,
  };
}

function toRapidoDisplay(totalCents: number): number {
  return Math.round(totalCents) / RAPIDO_PRECISION_SCALE;
}

async function purgeExpiredDeletedRowsForUser(userId: string): Promise<void> {
  const tables = getAdminTables();
  const storage = getAdminStorage();
  const nowIso = new Date().toISOString();

  const result = await tables.listRows<AnalysisHistoryRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
    queries: [
      Query.equal('user_id', userId),
      Query.equal('is_deleted', true),
      Query.lessThanEqual('purge_after', nowIso),
      Query.limit(50),
    ],
  });

    for (const row of result.rows) {
    const fileIds = new Set<string>();
    const previewId = extractFileIdFromUrl(row.preview_url || '');
    const sourceId = extractFileIdFromUrl(row.source_url || '');
    if (previewId) fileIds.add(previewId);
    if (sourceId) fileIds.add(sourceId);

    await Promise.allSettled(
      [...fileIds].map((fileId) =>
        storage.deleteFile({
          bucketId: APPWRITE_BUCKET_GALLERY_ID,
          fileId,
        }),
      ),
    );

    try {
      await tables.deleteRow({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
        rowId: row.$id,
      });
    } catch {
      // ignore deleted row races
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();
    await purgeExpiredDeletedRowsForUser(user.id);

    const params = request.nextUrl.searchParams;
    const limitRaw = Number(params.get('limit') ?? '12');
    const offsetRaw = Number(params.get('offset') ?? '0');

    const limit = Number.isFinite(limitRaw)
      ? Math.max(1, Math.min(MAX_PAGE_SIZE, limitRaw))
      : 12;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, offsetRaw) : 0;

    const tables = getAdminTables();
    const result = await tables.listRows<AnalysisHistoryRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
      queries: [
        Query.equal('user_id', user.id),
        Query.orderDesc('$createdAt'),
        Query.limit(limit),
        Query.offset(offset),
      ],
      total: true,
    });

    const items = result.rows.map((row) => ({
      id: row.$id,
      createdAt: row.$createdAt,
      title: row.title,
      critique: row.critique,
      score: typeof row.score === 'number' ? row.score : null,
      galleryType: row.gallery_type,
      analysisKind: row.analysis_kind ?? 'SINGLE_JURY',
      previewUrl: toOptimizedPreviewUrl(row.preview_url),
      sourceUrl: row.source_url ?? null,
      sourceMime: row.source_mime ?? null,
      isDeleted: row.is_deleted === true,
      deletedAt: row.deleted_at ?? null,
      purgeAfter: row.purge_after ?? null,
    }));

    return NextResponse.json({
      items,
      total: result.total,
    });
  } catch (error) {
    logServerError('api.analysis-history.GET', error);
    return NextResponse.json({ error: 'Analiz geçmişi alınamadı.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const body = (await request.json()) as {
      title?: string;
      critique?: string;
      score?: number | null;
      galleryType?: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'NONE';
      analysisKind?: string;
      imageBase64?: string;
      mimeType?: string;
      sourceBase64?: string;
      sourceMimeType?: string;
      preserveMode?: boolean;
    };

    const title = (body.title ?? '').trim() || 'İsimsiz Proje';
    const analysisKindRaw = (body.analysisKind ?? 'SINGLE_JURY').toUpperCase();
    // Multi-jury critiques are stored as structured JSON — do NOT normalize them through
    // normalizeCritiqueText because that function replaces `\n` sequences inside JSON
    // string values, producing invalid JSON that cannot be parsed back in the history view.
    const rawCritique = body.critique ?? '';
    const critique = analysisKindRaw === 'MULTI_JURY'
      ? rawCritique.trim()
      : normalizeCritiqueText(rawCritique);
    const galleryType = body.galleryType ?? 'NONE';
    const preserveMode = body.preserveMode === true;
    const sourceBase64 = (body.sourceBase64 ?? body.imageBase64 ?? '').trim();
    const sourceMimeType = (body.sourceMimeType ?? body.mimeType ?? 'image/jpeg').trim();

    if (!critique || !sourceBase64) {
      return NextResponse.json({ error: 'Eksik analiz verisi.' }, { status: 400 });
    }

    if (!ALLOWED_SOURCE_MIME_TYPES.has(sourceMimeType)) {
      return NextResponse.json({ error: 'Geçersiz pafta formatı. JPG/PNG/WEBP/PDF kabul edilir.' }, { status: 415 });
    }

    let preserveRapidoRemaining: number | undefined;

    if (preserveMode) {
      const profile = await getOrCreateProfile(user);
      const currentCents = toRapidoCents(
        profile.rapido_pens,
        normalizeRapidoFractionCents((profile as { rapido_fraction_cents?: unknown }).rapido_fraction_cents),
      );

      if (currentCents < ANALYSIS_PRESERVE_COST_CENTS) {
        return NextResponse.json(
          {
            error: 'Yetersiz Rapido.',
            code: 'INSUFFICIENT_RAPIDO',
            required: ANALYSIS_PRESERVE_COST_CENTS / RAPIDO_PRECISION_SCALE,
            available: toRapidoDisplay(currentCents),
          },
          { status: 402 },
        );
      }

      const nextCents = Math.max(0, currentCents - ANALYSIS_PRESERVE_COST_CENTS);
      const { rapidoPens, rapidoFractionCents } = splitRapidoCents(nextCents);

      await updateProfileById(user.id, {
        rapido_pens: rapidoPens,
        rapido_fraction_cents: rapidoFractionCents,
      });

      preserveRapidoRemaining = toRapidoDisplay(nextCents);
    }

    const ext = sourceMimeType === 'application/pdf'
      ? 'pdf'
      : (sourceMimeType.split('/')[1] || 'jpg');
    const fileId = ID.unique();
    const fileName = `${fileId}.${ext}`;
    const base64Part = sourceBase64.includes(',') ? sourceBase64.split(',')[1] : sourceBase64;
    if (!base64Part) {
      return NextResponse.json({ error: 'Pafta verisi bozuk.' }, { status: 400 });
    }

    const buffer = Buffer.from(base64Part, 'base64');
    if (!buffer.length) {
      return NextResponse.json({ error: 'Pafta verisi çözümlenemedi.' }, { status: 400 });
    }

    if (buffer.byteLength > MAX_SOURCE_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: 'Pafta dosyası 35MB sınırını aşıyor.',
          code: 'BOARD_TOO_LARGE',
        },
        { status: 413 },
      );
    }

    const file = new File([buffer], fileName, { type: sourceMimeType });

    const storage = getAdminStorage();
    await storage.createFile({
      bucketId: APPWRITE_BUCKET_GALLERY_ID,
      fileId,
      file,
    });

    const previewUrl = buildPreviewFileUrl(fileId);
    const sourceUrl = buildSourceFileUrl(fileId);

    const tables = getAdminTables();
    const created = await tables.createRow<AnalysisHistoryRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
      rowId: ID.unique(),
      data: {
        user_id: user.id,
        title,
        critique: critique.substring(0, 32000),
        score: typeof body.score === 'number' ? body.score : undefined,
        gallery_type: galleryType,
        analysis_kind: analysisKindRaw.substring(0, 32),
        preview_url: previewUrl,
        source_url: sourceUrl,
        source_mime: sourceMimeType.substring(0, 64),
        is_deleted: false,
        deleted_at: '',
        purge_after: '',
      },
    });

    invalidateProfileStatsCache(user.id);

    return NextResponse.json({
      charged: preserveMode ? ANALYSIS_PRESERVE_COST_CENTS / RAPIDO_PRECISION_SCALE : 0,
      rapido_remaining: preserveRapidoRemaining,
      item: {
        id: created.$id,
        createdAt: created.$createdAt,
        title,
        critique,
        score: typeof body.score === 'number' ? body.score : null,
        galleryType,
        analysisKind: analysisKindRaw,
        previewUrl,
        sourceUrl,
        sourceMime: sourceMimeType,
        isDeleted: false,
        deletedAt: null,
        purgeAfter: null,
      },
    });
  } catch (error) {
    const appwriteError = getAppwriteErrorDetails(error);
    const type = (appwriteError.type || appwriteError.responseType || '').toLowerCase();
    if (type.includes('storage_invalid_file_size') || type.includes('file_size')) {
      return NextResponse.json(
        {
          error: 'Pafta dosyasi Appwrite bucket limitini asiyor. Lutfen daha dusuk boyutlu bir dosya deneyin.',
          code: 'BOARD_TOO_LARGE',
          maxMb: Math.round(MAX_SOURCE_UPLOAD_BYTES / (1024 * 1024)),
        },
        { status: 413 },
      );
    }

    logServerError('api.analysis-history.POST', error);
    return NextResponse.json({ error: 'Analiz geçmişi kaydedilemedi.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giriş yapmanız gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const body = (await request.json()) as { historyId?: unknown };
    const historyId = typeof body.historyId === 'string' ? body.historyId.trim() : '';
    if (!historyId) {
      return NextResponse.json({ error: 'historyId gerekli.' }, { status: 400 });
    }

    const tables = getAdminTables();
    let row: AnalysisHistoryRow;

    try {
      row = await tables.getRow<AnalysisHistoryRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
        rowId: historyId,
      });
    } catch {
      return NextResponse.json({ error: 'Analiz kaydı bulunamadı.' }, { status: 404 });
    }

    if (row.user_id !== user.id) {
      return NextResponse.json({ error: 'Bu analiz kaydı size ait değil.' }, { status: 403 });
    }

    const deletedAt = new Date();
    const purgeAfter = new Date(deletedAt.getTime() + DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
      rowId: row.$id,
      data: {
        is_deleted: true,
        deleted_at: deletedAt.toISOString(),
        purge_after: purgeAfter.toISOString(),
      },
    });

    invalidateProfileStatsCache(user.id);

    return NextResponse.json({
      success: true,
      item: {
        id: row.$id,
        isDeleted: true,
        deletedAt: deletedAt.toISOString(),
        purgeAfter: purgeAfter.toISOString(),
      },
    });
  } catch (error) {
    logServerError('api.analysis-history.DELETE', error);
    return NextResponse.json({ error: 'Analiz silinemedi.' }, { status: 500 });
  }
}
