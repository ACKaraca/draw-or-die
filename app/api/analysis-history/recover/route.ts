import { NextRequest, NextResponse } from 'next/server';
import type { Models } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ANALYSIS_HISTORY_ID,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
  updateProfileById,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { normalizeCritiqueText } from '@/lib/critique';

const RAPIDO_PRECISION_SCALE = 100;
const BOARD_RECOVERY_COST_CENTS = 150; // 1.5 Rapido

type AnalysisHistoryRow = Models.Row & {
  user_id: string;
  title: string;
  critique: string;
  score?: number;
  gallery_type: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'NONE';
  analysis_kind?: string;
  preview_url: string;
};

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

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giris yapmaniz gerekiyor.' }, { status: 401 });
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
      return NextResponse.json({ error: 'Analiz kaydi bulunamadi.' }, { status: 404 });
    }

    if (row.user_id !== user.id) {
      return NextResponse.json({ error: 'Bu analiz kaydi size ait degil.' }, { status: 403 });
    }

    const profile = await getOrCreateProfile(user);
    const currentCents = toRapidoCents(
      profile.rapido_pens,
      normalizeRapidoFractionCents((profile as { rapido_fraction_cents?: unknown }).rapido_fraction_cents),
    );

    if (currentCents < BOARD_RECOVERY_COST_CENTS) {
      return NextResponse.json(
        {
          error: 'Yetersiz Rapido.',
          code: 'INSUFFICIENT_RAPIDO',
          required: BOARD_RECOVERY_COST_CENTS / RAPIDO_PRECISION_SCALE,
          available: toRapidoDisplay(currentCents),
        },
        { status: 402 },
      );
    }

    const nextCents = Math.max(0, currentCents - BOARD_RECOVERY_COST_CENTS);
    const { rapidoPens, rapidoFractionCents } = splitRapidoCents(nextCents);

    await updateProfileById(user.id, {
      rapido_pens: rapidoPens,
      rapido_fraction_cents: rapidoFractionCents,
    });

    return NextResponse.json({
      charged: BOARD_RECOVERY_COST_CENTS / RAPIDO_PRECISION_SCALE,
      rapido_remaining: toRapidoDisplay(nextCents),
      item: {
        id: row.$id,
        title: row.title,
        critique: normalizeCritiqueText(row.critique),
        score: typeof row.score === 'number' ? row.score : null,
        galleryType: row.gallery_type,
        analysisKind: row.analysis_kind ?? 'SINGLE_JURY',
        previewUrl: row.preview_url,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Kayitli pano geri yuklenemedi.' }, { status: 500 });
  }
}
