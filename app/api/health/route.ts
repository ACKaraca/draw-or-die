import { NextResponse } from 'next/server';

import { EMBEDDED_RELEASE_SHA } from '@/lib/release-manifest';

const RELEASE_SHA_ENV_NAMES = ['APPWRITE_VCS_COMMIT_HASH', 'VERCEL_GIT_COMMIT_SHA', 'RELEASE_SHA'] as const;
const DEPLOYMENT_ID_ENV_NAMES = [
  'APPWRITE_SITE_DEPLOYMENT',
  'VERCEL_DEPLOYMENT_ID',
  'RELEASE_DEPLOYMENT_ID',
] as const;
const UNKNOWN_RELEASE_VALUE = 'unknown';

function resolveReleaseSha(): string {
  for (const name of RELEASE_SHA_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value && /^[a-f0-9]{40}$/i.test(value)) return value.toLowerCase();
  }

  if (/^[a-f0-9]{40}$/i.test(EMBEDDED_RELEASE_SHA)) return EMBEDDED_RELEASE_SHA.toLowerCase();

  return UNKNOWN_RELEASE_VALUE;
}

function resolveDeploymentId(): string {
  for (const name of DEPLOYMENT_ID_ENV_NAMES) {
    const value = process.env[name]?.trim();
    if (value && value.length <= 128 && /^[a-z0-9._:-]+$/i.test(value)) return value;
  }

  return UNKNOWN_RELEASE_VALUE;
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: 'ok',
    service: 'draw-or-die',
    release: {
      sha: resolveReleaseSha(),
      deploymentId: resolveDeploymentId(),
    },
    timestamp: new Date().toISOString(),
  });
}
