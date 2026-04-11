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

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid payload' },
      { status: 400 },
    );
  }
}
