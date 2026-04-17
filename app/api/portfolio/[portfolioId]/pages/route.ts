import { NextRequest, NextResponse } from 'next/server';
import { ID, Query } from 'node-appwrite';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_PORTFOLIOS_ID,
  APPWRITE_TABLE_PORTFOLIO_PAGES_ID,
  PortfolioRow,
  PortfolioPageRow,
  getAdminTables,
  getAuthenticatedUserFromRequest,
  getOrCreateProfile,
  updateProfileById,
} from '@/lib/appwrite/server';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';
import { logServerError } from '@/lib/logger';
import { RAPIDO_COSTS } from '@/lib/pricing';
import { rapidoUnitsToCents, toRapidoCents, splitRapidoCents } from '@/lib/rapido-cents';

interface LayoutElement {
  id: string;
  type: 'image' | 'text' | 'shape';
  x: number;
  y: number;
  w: number;
  h: number;
  content?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  imageUrl?: string;
  objectFit?: 'cover' | 'contain';
  backgroundColor?: string;
  borderRadius?: number;
  opacity?: number;
}

interface PageLayout {
  background: string;
  elements: LayoutElement[];
}

function defaultLayout(imageUrls: string[], theme: string): PageLayout {
  const bg = theme === 'dark' ? '#0a0a0a' : theme === 'warm' ? '#fdf6e3' : '#f8f8f8';
  const textColor = theme === 'dark' ? '#ffffff' : '#111111';
  const elements: LayoutElement[] = [];

  if (imageUrls[0]) elements.push({ id: 'img1', type: 'image', x: 0, y: 0, w: 100, h: 55, imageUrl: imageUrls[0], objectFit: 'cover' });
  if (imageUrls[1]) elements.push({ id: 'img2', type: 'image', x: 0, y: 57, w: 48, h: 30, imageUrl: imageUrls[1], objectFit: 'cover' });
  if (imageUrls[2]) elements.push({ id: 'img3', type: 'image', x: 52, y: 57, w: 48, h: 30, imageUrl: imageUrls[2], objectFit: 'cover' });
  elements.push({ id: 'txt1', type: 'text', x: 5, y: 90, w: 90, h: 6, content: 'PROJECT TITLE', fontSize: 36, fontWeight: 'bold', color: textColor, textAlign: 'left' });
  elements.push({ id: 'txt2', type: 'text', x: 5, y: 97, w: 80, h: 4, content: 'Architecture · 2024', fontSize: 14, fontWeight: 'normal', color: textColor, textAlign: 'left' });

  return { background: bg, elements };
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/im, '')
    .trim();
}

async function generateAiLayout(imageUrls: string[], theme: string): Promise<PageLayout> {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.AI_MODEL || 'gpt-4o';

  if (!apiKey) return defaultLayout(imageUrls, theme);

  const prompt = `Design an architecture portfolio page layout as a JSON object. Theme: ${theme}. Images available: ${imageUrls.length}.
Images: ${imageUrls.slice(0, 8).map((u, i) => `[${i + 1}] ${u}`).join('\n')}

Return ONLY a JSON object with this exact schema:
{"background":"#hex color (dark=#0a0a0a, light=#f8f8f8, warm=#fdf6e3)","elements":[{"id":"e1","type":"image","x":0,"y":0,"w":100,"h":55,"imageUrl":"first_url","objectFit":"cover"},{"id":"e2","type":"text","x":5,"y":58,"w":90,"h":8,"content":"PROJECT TITLE","fontSize":36,"fontWeight":"bold","color":"#111","textAlign":"left"}]}
Place 1-3 images, 2-4 text elements. Total canvas is 100x141 (A4). Do not overflow.`;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        max_tokens: 2048,
      }),
    });
    if (!res.ok) return defaultLayout(imageUrls, theme);
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const rawText = json.choices?.[0]?.message?.content ?? '';
    const cleaned = stripMarkdownFences(rawText);

    try {
      const parsed = JSON.parse(cleaned) as PageLayout;
      if (typeof parsed.background !== 'string' || !Array.isArray(parsed.elements)) {
        throw new Error('Invalid layout shape');
      }
      return parsed;
    } catch {
      return defaultLayout(imageUrls, theme);
    }
  } catch {
    return defaultLayout(imageUrls, theme);
  }
}

function toPagePayload(row: PortfolioPageRow) {
  return {
    id: row.$id,
    portfolioId: row.portfolio_id,
    pageIndex: row.page_index,
    planJson: row.plan_json,
    layoutJson: row.layout_json,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ portfolioId: string }> },
) {
  const lang = getRequestLanguage(request);
  const { portfolioId } = await params;

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

    // Check user owns the portfolio
    const tables = getAdminTables();
    let portfolio: PortfolioRow;
    try {
      portfolio = await tables.getRow<PortfolioRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_PORTFOLIOS_ID,
        rowId: portfolioId,
      });
    } catch {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Portfolyo bulunamadı.', 'Portfolio not found.'), code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    if (portfolio.user_id !== user.id) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Bu portfolyoya erişim izniniz yok.', 'You do not have access to this portfolio.'), code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

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

    const { imageUrls, pageIndex, theme } = body as Record<string, unknown>;

    if (!Array.isArray(imageUrls) || imageUrls.length === 0 || imageUrls.length > 8) {
      return NextResponse.json(
        {
          error: pickLocalized(
            lang,
            'imageUrls 1-8 adet geçerli URL içermelidir.',
            'imageUrls must contain 1-8 valid URLs.',
          ),
          code: 'INVALID_IMAGE_URLS',
        },
        { status: 400 },
      );
    }

    for (const url of imageUrls) {
      if (typeof url !== 'string' || url.length > 500 || !url.startsWith('https://')) {
        return NextResponse.json(
          {
            error: pickLocalized(
              lang,
              'Her URL geçerli bir https adresi olmalı ve 500 karakteri aşmamalıdır.',
              'Each URL must be a valid https address and not exceed 500 characters.',
            ),
            code: 'INVALID_IMAGE_URL',
          },
          { status: 400 },
        );
      }
    }

    const resolvedTheme =
      theme === 'dark' || theme === 'light' || theme === 'warm' ? theme : 'light';

    const resolvedPageIndex =
      typeof pageIndex === 'number' && Number.isInteger(pageIndex) && pageIndex >= 0
        ? pageIndex
        : portfolio.page_count;

    // Check rapido balance
    const costCents = rapidoUnitsToCents(RAPIDO_COSTS.PORTFOLIO_PAGE);
    const currentBalanceCents = toRapidoCents(profile.rapido_pens, profile.rapido_fraction_cents);

    if (currentBalanceCents < costCents) {
      return NextResponse.json(
        {
          error: pickLocalized(
            lang,
            `Yetersiz Rapido. Bu işlem için ${RAPIDO_COSTS.PORTFOLIO_PAGE} Rapido gerekiyor.`,
            `Insufficient Rapido. This action requires ${RAPIDO_COSTS.PORTFOLIO_PAGE} Rapido.`,
          ),
          code: 'INSUFFICIENT_RAPIDO',
        },
        { status: 402 },
      );
    }

    // Generate AI layout
    const layout = await generateAiLayout(imageUrls as string[], resolvedTheme);
    const layoutJson = JSON.stringify(layout);

    // Create page row
    const pageRow = await tables.createRow<PortfolioPageRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PORTFOLIO_PAGES_ID,
      rowId: ID.unique(),
      data: {
        portfolio_id: portfolioId,
        user_id: user.id,
        page_index: resolvedPageIndex,
        plan_json: layoutJson,
        layout_json: layoutJson,
      } as any,
    });

    // Increment page_count on portfolio
    const newPageCount = portfolio.page_count + 1;
    await tables.updateRow<PortfolioRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PORTFOLIOS_ID,
      rowId: portfolioId,
      data: { page_count: newPageCount } as any,
    });

    // Deduct rapido
    const newBalanceCents = currentBalanceCents - costCents;
    const { rapidoPens, rapidoFractionCents } = splitRapidoCents(newBalanceCents);
    await updateProfileById(user.id, {
      rapido_pens: rapidoPens,
      rapido_fraction_cents: rapidoFractionCents,
    });

    return NextResponse.json(
      {
        page: toPagePayload(pageRow),
        rapido_remaining: rapidoPens + rapidoFractionCents / 100,
      },
      { status: 201 },
    );
  } catch (error) {
    logServerError('portfolio:pages:POST', error);
    return NextResponse.json(
      { error: pickLocalized(lang, 'Bir hata oluştu.', 'An error occurred.') },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ portfolioId: string }> },
) {
  const lang = getRequestLanguage(request);
  const { portfolioId } = await params;

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

    // Verify portfolio ownership
    const tables = getAdminTables();
    let portfolio: PortfolioRow;
    try {
      portfolio = await tables.getRow<PortfolioRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_PORTFOLIOS_ID,
        rowId: portfolioId,
      });
    } catch {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Portfolyo bulunamadı.', 'Portfolio not found.'), code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    if (portfolio.user_id !== user.id) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Bu portfolyoya erişim izniniz yok.', 'You do not have access to this portfolio.'), code: 'FORBIDDEN' },
        { status: 403 },
      );
    }

    const rows = await tables.listRows<PortfolioPageRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_PORTFOLIO_PAGES_ID,
      queries: [
        Query.equal('portfolio_id', portfolioId),
        Query.orderAsc('page_index'),
        Query.limit(100),
      ],
    });

    return NextResponse.json({ pages: rows.rows.map(toPagePayload) });
  } catch (error) {
    logServerError('portfolio:pages:GET', error);
    return NextResponse.json(
      { error: pickLocalized(lang, 'Bir hata oluştu.', 'An error occurred.') },
      { status: 500 },
    );
  }
}
