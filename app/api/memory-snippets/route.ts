import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
  MemorySnippetRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { invalidateProfileStatsCache } from '@/lib/profile-stats-cache';

const ALLOWED_DELETE_REASONS = new Set(['yanlis', 'hatali', 'guncel_degil', 'artik_kullanilmiyor']);

function normalizeCategory(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (value === 'CATEGORY_1' || value === 'USER_PROFILE') return 'USER_PROFILE';
  if (value === 'CATEGORY_2' || value === 'RECENT_CONTEXT') return 'RECENT_CONTEXT';
  if (value === 'CATEGORY_3' || value === 'ARCHITECT_STYLE_HIDDEN') return 'ARCHITECT_STYLE_HIDDEN';
  return value || 'USER_PROFILE';
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giris yapmaniz gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();
    const includeContext = request.nextUrl.searchParams.get('includeContext') === 'true';

    const tables = getAdminTables();
    const rows = await tables.listRows<MemorySnippetRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
      queries: [
        Query.equal('user_id', user.id),
        Query.equal('visible_to_user', true),
        Query.equal('deleted_by_user', false),
        Query.limit(24),
      ],
    });

    const items = rows.rows
      .map((row) => ({
        id: row.$id,
        category: normalizeCategory(row.category || ''),
        snippet: row.snippet,
        updatedFromOperation: row.updated_from_operation || null,
        updatedAt: row.$updatedAt,
      }))
      .filter((row) => row.snippet && row.category);

    if (!includeContext) {
      return NextResponse.json({ items });
    }

    const contextRows = await tables.listRows<MemorySnippetRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
      queries: [
        Query.equal('user_id', user.id),
        Query.limit(36),
      ],
    });

    const context = contextRows.rows
      .map((row) => ({
        id: row.$id,
        category: normalizeCategory(row.category || ''),
        snippet: row.snippet,
        visibleToUser: row.visible_to_user === true,
        userDeleted: row.deleted_by_user === true,
        updatedAt: row.$updatedAt,
      }))
      .filter((row) => row.snippet);

    return NextResponse.json({ items, context });
  } catch {
    return NextResponse.json({ error: 'AI hafiza notlari alinamadi.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Giris yapmaniz gerekiyor.' }, { status: 401 });
    }

    await ensureCoreAppwriteResources();

    const body = (await request.json()) as { snippetId?: unknown; reason?: unknown };
    const snippetId = typeof body.snippetId === 'string' ? body.snippetId.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().substring(0, 255) : '';

    if (!snippetId) {
      return NextResponse.json({ error: 'snippetId gerekli.' }, { status: 400 });
    }

    if (!reason) {
      return NextResponse.json({ error: 'Silme nedeni gerekli.' }, { status: 400 });
    }

    if (!ALLOWED_DELETE_REASONS.has(reason.toLowerCase())) {
      return NextResponse.json({ error: 'Gecersiz silme nedeni.' }, { status: 400 });
    }

    const tables = getAdminTables();
    let row: MemorySnippetRow;

    try {
      row = await tables.getRow<MemorySnippetRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
        rowId: snippetId,
      });
    } catch {
      return NextResponse.json({ error: 'Hafiza notu bulunamadi.' }, { status: 404 });
    }

    if (row.user_id !== user.id) {
      return NextResponse.json({ error: 'Bu hafiza notu size ait degil.' }, { status: 403 });
    }

    if (!row.visible_to_user) {
      return NextResponse.json({ error: 'Bu kategori silinemez.' }, { status: 403 });
    }

    await tables.updateRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_MEMORY_SNIPPETS_ID,
      rowId: row.$id,
      data: {
        deleted_by_user: true,
        delete_reason: reason.toLowerCase(),
        deleted_at: new Date().toISOString(),
      },
    });

    invalidateProfileStatsCache(user.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Hafiza notu silinemedi.' }, { status: 500 });
  }
}
