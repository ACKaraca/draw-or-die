import { NextRequest, NextResponse } from 'next/server';
import { ID } from 'node-appwrite';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_FEEDBACK_ID,
  getAdminTables,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';

const ALLOWED_CATEGORIES = new Set(['general', 'bug', 'feature', 'ux', 'billing']);

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown-ip';
}

function normalizeCategory(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_CATEGORIES.has(normalized) ? normalized : 'general';
}

function normalizeEmail(value: unknown): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!email) return '';
  if (email.length > 255) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
  return email;
}

function normalizeRating(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.trunc(value);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

function normalizeSourcePath(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';
  return raw.substring(0, 255);
}

function toCompactJson(value: unknown): string {
  try {
    return JSON.stringify(value).substring(0, 8000);
  } catch {
    return '{}';
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`feedback:${ip}`, {
    maxRequests: Math.max(8, RATE_LIMITS.GENERAL.maxRequests / 6),
    windowMs: RATE_LIMITS.GENERAL.windowMs,
  });

  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Cok fazla geri bildirim gonderildi. Lutfen bekleyin.' }, { status: 429 });
  }

  try {
    const payload = (await request.json()) as {
      message?: unknown;
      category?: unknown;
      email?: unknown;
      rating?: unknown;
      sourcePath?: unknown;
      context?: unknown;
    };

    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    if (!message || message.length < 8) {
      return NextResponse.json({ ok: false, error: 'Geri bildirim en az 8 karakter olmali.' }, { status: 400 });
    }

    const user = await getAuthenticatedUserFromRequest(request);
    const email = normalizeEmail(payload.email) || user?.email || '';
    const rating = normalizeRating(payload.rating);
    const category = normalizeCategory(payload.category);
    const sourcePath = normalizeSourcePath(payload.sourcePath);

    await ensureCoreAppwriteResources();

    const tables = getAdminTables();
    await tables.createRow({
      databaseId: APPWRITE_DATABASE_ID,
      tableId: APPWRITE_TABLE_FEEDBACK_ID,
      rowId: ID.unique(),
      data: {
        user_id: user?.id || '',
        email,
        category,
        message: message.substring(0, 6000),
        source_path: sourcePath,
        rating: rating ?? null,
        status: 'new',
        meta_json: toCompactJson({
          context: payload.context ?? null,
          ip,
          userAgent: request.headers.get('user-agent') || null,
          timestamp: new Date().toISOString(),
        }),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Feedback submit error:', error);
    return NextResponse.json({ ok: false, error: 'Geri bildirim kaydedilemedi.' }, { status: 500 });
  }
}
