import { NextRequest, NextResponse } from 'next/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PORTFOLIO_PAGES_ID,
  PortfolioPageRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
} from '@/lib/appwrite/server';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';
import { logServerError } from '@/lib/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ portfolioId: string; pageId: string }> },
) {
  const lang = getRequestLanguage(request);
  const { pageId } = await params;

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

    const { layoutJson } = body as Record<string, unknown>;

    if (typeof layoutJson !== 'string') {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'layoutJson bir string olmalıdır.', 'layoutJson must be a string.'),
          code: 'INVALID_LAYOUT_JSON',
        },
        { status: 400 },
      );
    }

    // Validate JSON is parseable
    try {
      JSON.parse(layoutJson);
    } catch {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'layoutJson geçerli bir JSON değil.', 'layoutJson is not valid JSON.'),
          code: 'INVALID_LAYOUT_JSON',
        },
        { status: 400 },
      );
    }

    const tables = getAdminTables();

    // Fetch page and verify ownership
    let page: PortfolioPageRow;
    try {
      page = await tables.getRow<PortfolioPageRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_PORTFOLIO_PAGES_ID,
        rowId: pageId,
      });
    } catch {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Sayfa bulunamadı.', 'Page not found.'), code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    if (page.user_id !== user.id) {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'Bu sayfaya erişim izniniz yok.', 'You do not have access to this page.'),
          code: 'FORBIDDEN',
        },
        { status: 403 },
      );
    }

    await tables.updateRow<PortfolioPageRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PORTFOLIO_PAGES_ID,
      rowId: pageId,
      data: { layout_json: layoutJson } as any,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError('portfolio:pages:PATCH', error);
    return NextResponse.json(
      { error: pickLocalized(lang, 'Bir hata oluştu.', 'An error occurred.') },
      { status: 500 },
    );
  }
}
