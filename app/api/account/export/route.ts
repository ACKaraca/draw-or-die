import { NextResponse, type NextRequest } from 'next/server';

import { getAuthenticatedUserFromRequest } from '@/lib/appwrite/server';
import { logServerError, logServerInfo } from '@/lib/logger';
import { createAppwritePrivacyPort } from '@/lib/privacy/data-port';
import { buildAccountExport } from '@/lib/privacy/export';
import { PrivacyApiMessages } from '@/lib/privacy/messages';
import { checkRateLimit } from '@/lib/rate-limit';
import { getRequestLanguage } from '@/lib/server-i18n';

export const dynamic = 'force-dynamic';

const EXPORT_RATE_LIMIT = { maxRequests: 3, windowMs: 60 * 60 * 1000 };

export async function GET(request: NextRequest): Promise<NextResponse> {
  const lang = getRequestLanguage(request);
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: PrivacyApiMessages.signInRequired(lang) }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(`account-export:${user.id}`, EXPORT_RATE_LIMIT);
  if (!rateLimit.allowed) {
    logServerInfo('privacy.export.rate_limited', { userId: user.id });
    return NextResponse.json({ error: PrivacyApiMessages.rateLimited(lang) }, { status: 429 });
  }

  try {
    const exported = await buildAccountExport({
      port: createAppwritePrivacyPort(),
      user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt ?? null },
    });
    logServerInfo('privacy.export.completed', {
      userId: user.id,
      formatVersion: exported.formatVersion,
      manifest: exported.manifest.map((entry) => `${entry.dataClass}:${entry.count}`).join(' '),
    });
    const fileDate = exported.generatedAt.slice(0, 10);
    return NextResponse.json(exported, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, private',
        'Content-Disposition': `attachment; filename="drawordie-data-export-${fileDate}.json"`,
      },
    });
  } catch (error) {
    logServerError('privacy.export.failed', error, { userId: user.id });
    return NextResponse.json({ error: PrivacyApiMessages.exportFailed(lang) }, { status: 503 });
  }
}
