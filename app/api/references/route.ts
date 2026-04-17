import { NextRequest, NextResponse } from 'next/server';
import { ID, Query } from 'node-appwrite';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
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

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 120);
}

function toCardPayload(row: ReferenceRow) {
  return {
    id: row.$id,
    slug: row.slug,
    title: row.title,
    architect: row.architect,
    year: row.year ?? null,
    location: row.location ?? '',
    typology: row.typology ?? '',
    summary: row.summary,
    coverImageUrl: row.cover_image_url ?? '',
    tags: safeJsonArray(row.tags_json),
    isPublished: Boolean(row.is_published),
  };
}

function safeJsonArray(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
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

    const profile = await getOrCreateProfile(user);
    if (!profile.is_premium) {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'Referans Kütüphanesi Premium üyelere özeldir.', 'Reference Library is Premium-only.'),
          code: 'PREMIUM_REQUIRED',
        },
        { status: 403 },
      );
    }

    const tables = getAdminTables();
    const rows = await tables.listRows<ReferenceRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_REFERENCES_ID,
      queries: [
        Query.equal('is_published', true),
        Query.orderDesc('$createdAt'),
        Query.limit(200),
      ],
    });

    return NextResponse.json({ references: rows.rows.map(toCardPayload) });
  } catch (error) {
    logServerError('references:GET', error);
    return NextResponse.json(
      { error: pickLocalized(lang, 'Bir hata oluştu.', 'An error occurred.') },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const lang = getRequestLanguage(request);
  try {
    await ensureCoreAppwriteResources();
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated', code: 'UNAUTHENTICATED' }, { status: 401 });
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    const rl = await checkRateLimit(`references-admin:${user.id}`, RATE_LIMITS.GENERAL);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Rate limited', code: 'RATE_LIMITED' }, { status: 429 });
    }

    const body = (await request.json()) as {
      title?: unknown;
      architect?: unknown;
      year?: unknown;
      location?: unknown;
      typology?: unknown;
      summary?: unknown;
      analysisMd?: unknown;
      coverImageUrl?: unknown;
      planImageUrls?: unknown;
      sectionImageUrls?: unknown;
      tags?: unknown;
      slug?: unknown;
      isPublished?: unknown;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const architect = typeof body.architect === 'string' ? body.architect.trim() : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    const analysisMd = typeof body.analysisMd === 'string' ? body.analysisMd.trim() : '';

    if (!title || !architect || !summary || !analysisMd) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'title, architect, summary, analysisMd zorunlu.', 'title, architect, summary, analysisMd are required.'), code: 'VALIDATION_ERROR' },
        { status: 400 },
      );
    }

    const providedSlug = typeof body.slug === 'string' && body.slug.trim() ? slugify(body.slug) : slugify(`${architect}-${title}`);
    const slug = providedSlug || `ref-${Date.now()}`;

    const toStringArrayJson = (val: unknown): string | undefined => {
      if (!Array.isArray(val)) return undefined;
      const arr = val.filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length < 1000);
      return arr.length ? JSON.stringify(arr).substring(0, 8000) : undefined;
    };

    const data = {
      slug,
      title: title.substring(0, 200),
      architect: architect.substring(0, 200),
      year: typeof body.year === 'number' && Number.isFinite(body.year) ? Math.trunc(body.year) : undefined,
      location: typeof body.location === 'string' ? body.location.trim().substring(0, 200) : undefined,
      typology: typeof body.typology === 'string' ? body.typology.trim().substring(0, 120) : undefined,
      summary: summary.substring(0, 2000),
      analysis_md: analysisMd.substring(0, 60_000),
      cover_image_url: typeof body.coverImageUrl === 'string' ? body.coverImageUrl.trim().substring(0, 1000) : undefined,
      plan_image_urls: toStringArrayJson(body.planImageUrls),
      section_image_urls: toStringArrayJson(body.sectionImageUrls),
      tags_json: toStringArrayJson(body.tags),
      is_published: body.isPublished !== false,
    };

    const tables = getAdminTables();
    const row = await tables.createRow<ReferenceRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_REFERENCES_ID,
      rowId: ID.unique(),
      data,
    });

    return NextResponse.json({ reference: toCardPayload(row) }, { status: 201 });
  } catch (error) {
    logServerError('references:POST', error);
    return NextResponse.json(
      { error: pickLocalized(lang, 'Referans oluşturulamadı.', 'Could not create reference.') },
      { status: 500 },
    );
  }
}
