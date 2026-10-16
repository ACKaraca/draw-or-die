import { createHash, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { logServerError, logServerInfo } from '@/lib/logger';
import { sweepExpiredRapidoReservations } from '@/lib/rapido-reservation-sweeper';

export const dynamic = 'force-dynamic';

// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`; any other scheduler must do the same.
function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  const header = request.headers.get('authorization') ?? '';
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await sweepExpiredRapidoReservations();
    logServerInfo('rapido.sweep.completed', result);
    return NextResponse.json(result);
  } catch (error) {
    logServerError('rapido.sweep.failed', error);
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}
