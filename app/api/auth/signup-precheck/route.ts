import { NextRequest, NextResponse } from 'next/server';
import { Query, Users } from 'node-appwrite';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/appwrite/server';
import { canonicalizeAuthEmail, isValidEmailFormat } from '@/lib/auth-email';

function getClientIp(request: NextRequest): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-vercel-forwarded-for')
    || request.headers.get('x-forwarded-for')?.split(',').map((value) => value.trim()).find(Boolean)
    || 'unknown-ip';
}

async function hasGmailCanonicalConflict(users: Users, canonicalEmail: string): Promise<boolean> {
  const atIndex = canonicalEmail.lastIndexOf('@');
  if (atIndex <= 0) return false;

  const canonicalLocalPart = canonicalEmail.slice(0, atIndex);
  const response = await users.list({
    queries: [
      Query.search('email', canonicalLocalPart),
      Query.limit(100),
    ],
  });

  const candidates = Array.isArray(response.users) ? response.users : [];
  for (const user of candidates) {
    const email = typeof user.email === 'string' ? user.email : '';
    if (!email) continue;

    const existingCanonical = canonicalizeAuthEmail(email);
    if (existingCanonical.isGmailFamily && existingCanonical.canonicalEmail === canonicalEmail) {
      return true;
    }
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rawBody = await request.json().catch(() => ({})) as { email?: unknown };
    const email = typeof rawBody.email === 'string' ? rawBody.email : '';

    const normalized = canonicalizeAuthEmail(email);
    if (!normalized.normalizedEmail || !isValidEmailFormat(normalized.normalizedEmail)) {
      return NextResponse.json({ error: 'Gecerli bir email adresi girin.' }, { status: 400 });
    }

    const rl = await checkRateLimit(`signup-precheck:${ip}:${normalized.canonicalEmail}`, {
      maxRequests: 15,
      windowMs: 60 * 1000,
    });

    if (!rl.allowed) {
      return NextResponse.json({ error: 'Cok fazla kayit denemesi. Lutfen tekrar deneyin.' }, { status: 429 });
    }

    if (normalized.isGmailFamily) {
      const users = new Users(createAdminClient());
      const hasConflict = await hasGmailCanonicalConflict(users, normalized.canonicalEmail);

      if (hasConflict) {
        return NextResponse.json(
          {
            error: 'Bu Gmail adresinin noktasiz surumu daha once kaydolmus.',
            code: 'GMAIL_CANONICAL_CONFLICT',
            canonicalEmail: normalized.canonicalEmail,
          },
          { status: 409 },
        );
      }
    }

    return NextResponse.json({
      canonicalEmail: normalized.canonicalEmail,
      gmailCanonicalized: normalized.gmailCanonicalized,
    });
  } catch (error) {
    console.error('Signup precheck error:', error);
    return NextResponse.json({ error: 'Kayit on kontrolu yapilamadi.' }, { status: 500 });
  }
}
