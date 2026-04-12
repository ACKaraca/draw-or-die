import { NextRequest, NextResponse } from 'next/server';
import { Query, Users } from 'node-appwrite';
import { checkRateLimit } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/appwrite/server';
import { canonicalizeAuthEmail, isValidEmailFormat } from '@/lib/auth-email';

const LIST_PAGE_SIZE = 100;
const MAX_SCANNED_USERS = 10000;

function getClientIp(request: NextRequest): string {
  const runtimeIp = (request as NextRequest & { ip?: string | null }).ip?.trim();
  const vercelIp = request.headers.get('x-vercel-forwarded-for')?.split(',').map((value) => value.trim()).find(Boolean);

  return runtimeIp
    || request.headers.get('cf-connecting-ip')?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || vercelIp
    || 'unknown-ip';
}

async function hasGmailCanonicalConflict(users: Users, canonicalEmail: string): Promise<boolean> {
  let offset = 0;
  let scannedUsers = 0;

  while (scannedUsers < MAX_SCANNED_USERS) {
    const response = await users.list({
      queries: [
        Query.limit(LIST_PAGE_SIZE),
        Query.offset(offset),
      ],
    });

    const pageUsers = Array.isArray(response.users) ? response.users : [];
    if (pageUsers.length === 0) {
      return false;
    }

    for (const user of pageUsers) {
      const email = typeof user.email === 'string' ? user.email : '';
      if (!email) continue;

      const existingCanonical = canonicalizeAuthEmail(email);
      if (existingCanonical.isGmailFamily && existingCanonical.canonicalEmail === canonicalEmail) {
        return true;
      }
    }

    scannedUsers += pageUsers.length;
    offset += pageUsers.length;

    if (pageUsers.length < LIST_PAGE_SIZE) {
      return false;
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
