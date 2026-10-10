import { NextResponse, type NextRequest } from 'next/server';

import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_CONFESSIONS_ID,
  getAdminTables,
  type ConfessionRow,
} from '@/lib/appwrite/server';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { isAppwriteNotFound } from '@/lib/appwrite/error-utils';
import { checkRateLimit, type RateLimitConfig } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/client-ip';
import { logServerError } from '@/lib/logger';
import { getRequestLanguage } from '@/lib/server-i18n';
import { pickLocalized } from '@/lib/i18n';

const LIKE_IP_RATE_LIMIT: RateLimitConfig = { maxRequests: 30, windowMs: 60 * 1000 };
const LIKE_PER_ANON_RATE_LIMIT: RateLimitConfig = { maxRequests: 1, windowMs: 365 * 24 * 60 * 60 * 1000 };
const MAX_ANON_KEY_LENGTH = 64;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const lang = getRequestLanguage(request);
  const notFoundResponse = () => NextResponse.json(
    { error: pickLocalized(lang, 'İtiraf bulunamadı.', 'Confession not found.'), code: 'NOT_FOUND' },
    { status: 404 },
  );

  try {
    const { id } = await params;
    const confessionId = typeof id === 'string' ? id.trim() : '';
    if (!confessionId) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Geçersiz itiraf kimliği.', 'Invalid confession ID.'), code: 'INVALID_ID' },
        { status: 400 },
      );
    }

    let anonKey = '';
    try {
      const body = (await request.json()) as { anonKey?: unknown };
      anonKey = typeof body.anonKey === 'string' ? body.anonKey.trim() : '';
    } catch {
      anonKey = '';
    }

    if (!anonKey || anonKey.length > MAX_ANON_KEY_LENGTH) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'anonKey gerekli.', 'anonKey is required.'), code: 'MISSING_ANON_KEY' },
        { status: 400 },
      );
    }

    const ipLimiter = await checkRateLimit(`confessions-like-ip:${getClientIp(request)}`, LIKE_IP_RATE_LIMIT);
    if (!ipLimiter.allowed) {
      return NextResponse.json(
        {
          error: pickLocalized(lang, 'Çok fazla istek. Lütfen bekle.', 'Too many requests. Please wait.'),
          code: 'RATE_LIMIT_EXCEEDED',
        },
        { status: 429 },
      );
    }

    await ensureCoreAppwriteResources();
    const tables = getAdminTables();

    let row: ConfessionRow;
    try {
      row = await tables.getRow<ConfessionRow>({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_CONFESSIONS_ID,
        rowId: confessionId,
      });
    } catch (error) {
      if (isAppwriteNotFound(error)) return notFoundResponse();
      throw error;
    }

    if (row.status !== 'approved') {
      return notFoundResponse();
    }

    // Checked after the existence check so a typo'd id does not burn the one-like slot.
    const anonLimiter = await checkRateLimit(`confessions-like:${confessionId}:${anonKey}`, LIKE_PER_ANON_RATE_LIMIT);
    if (!anonLimiter.allowed) {
      return NextResponse.json(
        { error: pickLocalized(lang, 'Zaten beğendin.', 'Already liked.'), code: 'ALREADY_LIKED' },
        { status: 409 },
      );
    }

    const updated = await tables.incrementRowColumn<ConfessionRow>({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_CONFESSIONS_ID,
      rowId: confessionId,
      column: 'likes',
      value: 1,
    });

    return NextResponse.json({ likes: updated.likes });
  } catch (error) {
    logServerError('confessions:like:POST', error);
    return NextResponse.json(
      { error: pickLocalized(lang, 'Beğeni kaydedilemedi.', 'Failed to like confession.'), code: 'LIKE_FAILED' },
      { status: 500 },
    );
  }
}
