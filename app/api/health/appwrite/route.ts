import { NextResponse } from 'next/server';

import { getAuthenticatedUserFromRequest } from '@/lib/appwrite/server';
import { validateCoreAppwriteResources } from '@/lib/appwrite/resource-validation';

export async function GET(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const issues = await validateCoreAppwriteResources();

  return NextResponse.json({
    status: issues.length === 0 ? 'ok' : 'degraded',
    issues,
    timestamp: new Date().toISOString(),
  });
}
