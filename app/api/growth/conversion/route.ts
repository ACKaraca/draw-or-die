import { NextResponse } from 'next/server';

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

    const ip =
      request.headers.get('x-forwarded-for') ??
      request.headers.get('x-real-ip') ??
      'unknown';

    console.info(
      '[growth-conversion][DrawOrDie]',
      JSON.stringify({
        eventName: payload.eventName,
        metadata: payload.metadata ?? {},
        utm: payload.utm ?? {},
        page: payload.page ?? null,
        referrer: payload.referrer ?? null,
        occurredAt: payload.occurredAt ?? new Date().toISOString(),
        ip,
      }),
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid payload' },
      { status: 400 },
    );
  }
}
