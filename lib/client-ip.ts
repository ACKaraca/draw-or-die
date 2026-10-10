import type { NextRequest } from 'next/server';

/**
 * Best-effort client IP for rate-limit keys. Prefers headers set by the hosting edge
 * (Vercel overwrites `x-forwarded-for` / `x-vercel-forwarded-for`), so the value is not
 * client-controlled in production.
 */
export function getClientIp(request: NextRequest): string {
  const runtimeIp = (request as NextRequest & { ip?: string | null }).ip?.trim();
  if (runtimeIp) return runtimeIp;

  for (const header of ['x-vercel-forwarded-for', 'x-forwarded-for']) {
    const first = request.headers.get(header)?.split(',').map((part) => part.trim()).find(Boolean);
    if (first) return first;
  }

  return request.headers.get('x-real-ip')?.trim()
    || request.headers.get('cf-connecting-ip')?.trim()
    || 'unknown-ip';
}
