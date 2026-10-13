import { NextResponse } from 'next/server';

import { logServerInfo } from '@/lib/logger';
import { isProductionRequestHeaders } from '@/lib/site-identity';

type ConversionPayload = {
  eventName?: string;
  metadata?: Record<string, unknown>;
  utm?: Record<string, unknown>;
  page?: string;
  referrer?: string | null;
  occurredAt?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ConversionPayload;
    if (!payload.eventName || typeof payload.eventName !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'eventName is required' },
        { status: 400 },
      );
    }

    // Dev/preview hosts must never write into production growth data.
    if (!isProductionRequestHeaders(request.headers)) {
      logServerInfo('growth.conversion', { skipped: 'non_production', eventName: payload.eventName.slice(0, 64) });
      return NextResponse.json({ ok: true, skipped: true }, { status: 202 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid payload' },
      { status: 400 },
    );
  }
}
