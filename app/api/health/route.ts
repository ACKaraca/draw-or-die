import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'draw-or-die',
    timestamp: new Date().toISOString(),
  });
}
