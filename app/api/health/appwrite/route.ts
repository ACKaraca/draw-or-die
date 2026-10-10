import { NextResponse } from 'next/server';

import { getAuthenticatedUserFromRequest, isVerifiedAdmin } from '@/lib/appwrite/server';
import { validateCoreAppwriteResources } from '@/lib/appwrite/resource-validation';

type ValidationIssue = Awaited<ReturnType<typeof validateCoreAppwriteResources>>[number];

type ValidationSnapshot = {
  issues: ValidationIssue[];
  timestamp: string;
  expiresAt: number;
};

// Every signed-in session pings this route once and each validation costs ~17 admin
// schema calls, so one result is shared per instance; schema only changes on deploy.
const VALIDATION_CACHE_TTL_MS = 10 * 60 * 1000;

let cachedSnapshot: ValidationSnapshot | null = null;
let inflightSnapshot: Promise<ValidationSnapshot> | null = null;

async function getValidationSnapshot(): Promise<ValidationSnapshot> {
  if (cachedSnapshot && cachedSnapshot.expiresAt > Date.now()) {
    return cachedSnapshot;
  }

  if (!inflightSnapshot) {
    inflightSnapshot = (async () => {
      try {
        const issues = await validateCoreAppwriteResources();
        const snapshot: ValidationSnapshot = {
          issues,
          timestamp: new Date().toISOString(),
          expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
        };
        cachedSnapshot = snapshot;
        return snapshot;
      } finally {
        inflightSnapshot = null;
      }
    })();
  }

  return inflightSnapshot;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { issues, timestamp } = await getValidationSnapshot();
  // Raw Appwrite error messages can leak internals; only admins get the details.
  const visibleIssues = isVerifiedAdmin(user)
    ? issues
    : issues.map(({ resource }) => ({ resource }));

  return NextResponse.json({
    status: issues.length === 0 ? 'ok' : 'degraded',
    issues: visibleIssues,
    timestamp,
  });
}
