import { NextRequest, NextResponse } from 'next/server';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_CONFESSIONS_ID,
  getAdminTables,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { logServerError } from '@/lib/logger';
import type { ConfessionRow } from '@/lib/appwrite/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== 'string' || !id.trim()) {
      return NextResponse.json({ error: 'Invalid confession ID.', code: 'INVALID_ID' }, { status: 400 });
    }

    const confessionId = id.trim();

    const body = (await request.json()) as { anonKey?: string };
    const anonKey = (body.anonKey ?? '').trim();

    if (!anonKey) {
      return NextResponse.json({ error: 'anonKey is required.', code: 'MISSING_ANON_KEY' }, { status: 400 });
    }

    await ensureCoreAppwriteResources();

    const tables = getAdminTables();

    // Fetch the confession to verify it exists and is approved
    let row: ConfessionRow;
    try {
      row = await tables.getRow<ConfessionRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_CONFESSIONS_ID,
        rowId: confessionId,
      });
    } catch {
      return NextResponse.json({ error: 'Confession not found.', code: 'NOT_FOUND' }, { status: 404 });
    }

    if (row.status !== 'approved') {
      return NextResponse.json({ error: 'Confession not found.', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Increment likes (optimistic, no double-like prevention in DB)
    const currentLikes = typeof row.likes === 'number' && Number.isFinite(row.likes) ? row.likes : 0;
    const newLikes = Math.min(currentLikes + 1, 999999);

    const updated = await tables.updateRow<ConfessionRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_CONFESSIONS_ID,
      rowId: confessionId,
      data: { likes: newLikes },
    });

    return NextResponse.json({ likes: updated.likes });
  } catch (error) {
    logServerError('confessions:like:POST', error);
    return NextResponse.json({ error: 'Failed to like confession.', code: 'LIKE_FAILED' }, { status: 500 });
  }
}
