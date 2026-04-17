import { NextRequest, NextResponse } from 'next/server';
import { Query } from 'node-appwrite';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_REFERENCES_ID,
  ReferenceRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
  isAdminEmail,
} from '@/lib/appwrite/server';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';
import { logServerError } from '@/lib/logger';

function safeJsonArray(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function toDetailPayload(row: ReferenceRow) {
  return {
    id: row.$id,
    slug: row.slug,
    title: row.title,
    architect: row.architect,
    year: row.year ?? null,
    location: row.location ?? '',
    typology: row.typology ?? '',
    summary: row.summary,
    analysisMd: row.analysis_md,
    coverImageUrl: row.cover_image_url ?? '',
    planImageUrls: safeJsonArray(row.plan_image_urls),
    sectionImageUrls: safeJsonArray(row.section_image_urls),
    tags: safeJsonArray(row.tags_json),
    isPublished: Boolean(row.is_published),
  };
}

async function findReference(idOrSlug: string): Promise<ReferenceRow | null> {
  const tables = getAdminTables();

  try {
    const row = await tables.getRow<ReferenceRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_REFERENCES_ID,
      rowId: idOrSlug,
    });
    return row;
  } catch {
    // fall through to slug lookup
  }

  const list = await tables.listRows<ReferenceRow>({
    databaseId: APPWRITE_DATABASE_ID,
    tableId: APPWRITE_TABLE_REFERENCES_ID,
    queries: [Query.equal('slug', idOrSlug), Query.limit(1)],
  });

  return list.rows[0] ?? null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const lang = getRequestLanguage(request);
  const { id } = await params;

  try {
    await ensureCoreAppwriteResources();
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Giriş yapmanız gerekiyor.', 'You must sign in.'), code: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    const profile = await getOrCreateProfile(user);
    const isAdmin = isAdminEmail(user.email);
    if (!profile.is_premium && !isAdmin) {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'Referans Kütüphanesi Premium üyelere özeldir.', 'Reference Library is Premium-only.'),
          code: 'PREMIUM_REQUIRED',
        },
        { status: 403 },
      );
    }

    const row = await findReference(id);
    if (!row || (!row.is_published && !isAdmin)) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Referans bulunamadı.', 'Reference not found.'), code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json({ reference: toDetailPayload(row) });
  } catch (error) {
    logServerError('references:id:GET', error);
    return NextResponse.json(
      { error: pickLocalized(lang, 'Bir hata oluştu.', 'An error occurred.') },
      { status: 500 },
    );
  }
}
