import { GET } from '@/app/api/health/route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown) => ({
      status: 200,
      json: async () => body,
    }),
  },
}));

const RELEASE_ENV_NAMES = [
  'APPWRITE_VCS_COMMIT_HASH',
  'VERCEL_GIT_COMMIT_SHA',
  'RELEASE_SHA',
  'APPWRITE_SITE_DEPLOYMENT',
  'VERCEL_DEPLOYMENT_ID',
  'RELEASE_DEPLOYMENT_ID',
] as const;

describe('health release identity', () => {
  const originalValues = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const name of RELEASE_ENV_NAMES) {
      originalValues.set(name, process.env[name]);
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const name of RELEASE_ENV_NAMES) {
      const value = originalValues.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    originalValues.clear();
  });

  it('returns validated Appwrite release identity', async () => {
    process.env.APPWRITE_VCS_COMMIT_HASH = 'ABCDEF0123456789ABCDEF0123456789ABCDEF01';
    process.env.APPWRITE_SITE_DEPLOYMENT = 'site-deployment_123';

    const response = await GET();
    const payload = await response.json();

    expect(payload.release).toEqual({
      sha: 'abcdef0123456789abcdef0123456789abcdef01',
      deploymentId: 'site-deployment_123',
    });
  });

  it('does not expose malformed release values', async () => {
    process.env.RELEASE_SHA = 'not-a-commit';
    process.env.VERCEL_DEPLOYMENT_ID = 'unsafe deployment value';

    const response = await GET();
    const payload = await response.json();

    expect(payload.release).toEqual({ sha: 'unknown', deploymentId: 'unknown' });
  });

  it('uses explicit release fallbacks outside managed hosting', async () => {
    process.env.RELEASE_SHA = '1234567890abcdef1234567890abcdef12345678';
    process.env.RELEASE_DEPLOYMENT_ID = 'github-123-1';

    const response = await GET();
    const payload = await response.json();

    expect(payload.release).toEqual({
      sha: '1234567890abcdef1234567890abcdef12345678',
      deploymentId: 'github-123-1',
    });
  });
});
