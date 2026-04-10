import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || 'unknown-ip';
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`client-log:${ip}`, {
    maxRequests: Math.max(30, RATE_LIMITS.GENERAL.maxRequests),
    windowMs: RATE_LIMITS.GENERAL.windowMs,
  });

  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Rate limit' }, { status: 429 });
  }

  try {
    const body = (await request.json()) as {
      scope?: string;
      message?: string;
      details?: unknown;
      requestId?: string;
      level?: 'error' | 'warn' | 'info';
    };

    const level = body.level ?? 'error';
    const scope = body.scope ?? 'client';
    const message = body.message ?? 'Client-side error';

    const structured = {
      ts: new Date().toISOString(),
      source: 'client',
      level,
      scope,
      message,
      requestId: body.requestId ?? null,
      details: body.details ?? null,
      ip,
      userAgent: request.headers.get('user-agent') ?? null,
    };

    if (level === 'warn') {
      console.warn('[client-log]', JSON.stringify(structured));
    } else if (level === 'info') {
      console.info('[client-log]', JSON.stringify(structured));
    } else {
      console.error('[client-log]', JSON.stringify(structured));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[client-log] parse failed', error);
    return NextResponse.json({ ok: false, error: 'Invalid log payload' }, { status: 400 });
  }
}
