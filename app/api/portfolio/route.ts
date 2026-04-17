import { NextRequest, NextResponse } from 'next/server';
import { ID, Query } from 'node-appwrite';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PORTFOLIOS_ID,
  PortfolioRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
} from '@/lib/appwrite/server';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';
import { logServerError } from '@/lib/logger';

function toPortfolioPayload(row: PortfolioRow) {
  return {
    id: row.$id,
    title: row.title,
    subtitle: row.subtitle ?? null,
    pageCount: row.page_count,
    isPublic: Boolean(row.is_public),
    shareSlug: row.share_slug ?? null,
    coverUrl: row.cover_url ?? null,
    lastPublishedAt: row.last_published_at ?? null,
    createdAt: row.$createdAt,
  };
}

export async function POST(request: NextRequest) {
  const lang = getRequestLanguage(request);
  try {
    await ensureCoreAppwriteResources();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Giriş yapmanız gerekiyor.', 'You must sign in.'), code: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    await getOrCreateProfile(user);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Geçersiz istek gövdesi.', 'Invalid request body.'), code: 'INVALID_BODY' },
        { status: 400 },
      );
    }

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Geçersiz istek gövdesi.', 'Invalid request body.'), code: 'INVALID_BODY' },
        { status: 400 },
      );
    }

    const { title, subtitle } = body as Record<string, unknown>;

    if (typeof title !== 'string' || title.trim().length === 0 || title.trim().length > 200) {
      return NextResponse.json(
        {
          error: pickLocalized(
            lang,
            'Başlık 1-200 karakter arasında olmalıdır.',
            'Title must be between 1 and 200 characters.',
          ),
          code: 'INVALID_TITLE',
        },
        { status: 400 },
      );
    }

    const trimmedTitle = title.trim();
    const trimmedSubtitle =
      typeof subtitle === 'string' && subtitle.trim().length > 0 ? subtitle.trim() : undefined;

    const tables = getAdminTables();
    const row = await tables.createRow<PortfolioRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PORTFOLIOS_ID,
      rowId: ID.unique(),
      data: {
        user_id: user.id,
        title: trimmedTitle,
        subtitle: trimmedSubtitle ?? '',
        page_count: 0,
        is_public: false,
      } as any,
    });

    return NextResponse.json({ portfolio: toPortfolioPayload(row) }, { status: 201 });
  } catch (error) {
    logServerError('portfolio:POST', error);
    return NextResponse.json(
      { error: pickLocalized(lang, 'Bir hata oluştu.', 'An error occurred.') },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const lang = getRequestLanguage(request);
  try {
    await ensureCoreAppwriteResources();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Giriş yapmanız gerekiyor.', 'You must sign in.'), code: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    await getOrCreateProfile(user);

    const tables = getAdminTables();
    const rows = await tables.listRows<PortfolioRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PORTFOLIOS_ID,
      queries: [
        Query.equal('user_id', user.id),
        Query.orderDesc('$createdAt'),
        Query.limit(20),
      ],
    });

    return NextResponse.json({ portfolios: rows.rows.map(toPortfolioPayload) });
  } catch (error) {
    logServerError('portfolio:GET', error);
    return NextResponse.json(
      { error: pickLocalized(lang, 'Bir hata oluştu.', 'An error occurred.') },
      { status: 500 },
    );
  }
}
