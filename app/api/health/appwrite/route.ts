import { NextResponse } from 'next/server';

import { validateCoreAppwriteResources } from '@/lib/appwrite/resource-validation';

export async function GET() {
  const issues = await validateCoreAppwriteResources();

  return NextResponse.json({
    status: issues.length === 0 ? 'ok' : 'degraded',
    issues,
    timestamp: new Date().toISOString(),
  });
}
