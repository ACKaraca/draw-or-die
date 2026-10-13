import nextConfig from '@/next.config';
import {
  LEGACY_HOSTS,
  PRODUCTION_ANALYTICS_IDS,
  PRODUCTION_ORIGIN,
  buildLegacyRedirects,
  buildRobotsMetadata,
  buildSearchIdentityHeaders,
  isProductionDeployment,
  isProductionRequest,
  isProductionRequestHeaders,
  normalizeHost,
  resolveAnalyticsDestinationIds,
  resolveMetadataBase,
  resolveSiteUrl,
} from '@/lib/site-identity';

const PROD_ENV = { NODE_ENV: 'production', VERCEL_ENV: 'production' };

function headerStore(values: Record<string, string>): { get(name: string): string | null } {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

function hostMatches(pattern: string, host: string): boolean {
  // Same anchoring Next.js applies to `has`/`missing` host conditions.
  return new RegExp(`^${pattern}$`).test(host);
}

describe('site identity: production detection', () => {
  it('treats only the production host on a production build as production', () => {
    expect(isProductionRequest('drawordie.app', PROD_ENV)).toBe(true);
    expect(isProductionRequest('DrawOrDie.app:443', PROD_ENV)).toBe(true);
    expect(isProductionRequest('dev.drawordie.app', PROD_ENV)).toBe(false);
    expect(isProductionRequest('draw-or-die-git-feat.vercel.app', PROD_ENV)).toBe(false);
    expect(isProductionRequest('drawordie.ackaraca.me', PROD_ENV)).toBe(false);
    expect(isProductionRequest('localhost', PROD_ENV)).toBe(false);
    expect(isProductionRequest(null, PROD_ENV)).toBe(false);
  });

  it('lets VERCEL_ENV and SITE_ENV veto production even on the production host', () => {
    expect(isProductionRequest('drawordie.app', { NODE_ENV: 'production', VERCEL_ENV: 'preview' })).toBe(false);
    expect(isProductionRequest('drawordie.app', { NODE_ENV: 'production', SITE_ENV: 'staging' })).toBe(false);
    expect(isProductionRequest('drawordie.app', { NODE_ENV: 'development' })).toBe(false);
    // Non-Vercel hosting (e.g. Appwrite Sites) has no VERCEL_ENV.
    expect(isProductionDeployment({ NODE_ENV: 'production' })).toBe(true);
  });

  it('reads the forwarded host before the raw host header', () => {
    expect(isProductionRequestHeaders(
      headerStore({ 'x-forwarded-host': 'drawordie.app, internal', host: 'internal:3000' }),
      PROD_ENV,
    )).toBe(true);
    expect(isProductionRequestHeaders(headerStore({ host: 'dev.drawordie.app' }), PROD_ENV)).toBe(false);
  });

  it('normalizes hosts', () => {
    expect(normalizeHost(' DRAWORDIE.APP.:8080 ')).toBe('drawordie.app');
    expect(normalizeHost('')).toBeNull();
  });
});

describe('site identity: metadata', () => {
  it('pins production metadataBase to drawordie.app regardless of env', () => {
    const base = resolveMetadataBase(true, { NEXT_PUBLIC_APP_URL: 'https://dev.drawordie.app' });
    expect(base.origin).toBe(PRODUCTION_ORIGIN);
  });

  it('never resolves a legacy or malformed site URL', () => {
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: 'https://drawordie.ackaraca.me' })).toBe(PRODUCTION_ORIGIN);
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: 'https://www.drawordie.app/' })).toBe(PRODUCTION_ORIGIN);
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: 'not a url' })).toBe(PRODUCTION_ORIGIN);
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: 'javascript:alert(1)' })).toBe(PRODUCTION_ORIGIN);
    expect(resolveSiteUrl({})).toBe(PRODUCTION_ORIGIN);
    expect(resolveSiteUrl({ NEXT_PUBLIC_APP_URL: 'https://dev.drawordie.app/x' })).toBe('https://dev.drawordie.app');
  });

  it('marks non-production as noindex,nofollow and leaves production indexable', () => {
    expect(buildRobotsMetadata(false)).toEqual({ index: false, follow: false });
    expect(buildRobotsMetadata(true)).toBeUndefined();
  });
});

describe('site identity: analytics isolation', () => {
  const sharedEnv = {
    NEXT_PUBLIC_GOOGLE_TAG_ID: 'GT-5TCMV7L2',
    NEXT_PUBLIC_GA_MEASUREMENT_ID: 'G-1159TDRHXC',
  };

  it('never returns a production analytics ID outside production', () => {
    expect(resolveAnalyticsDestinationIds(false, sharedEnv)).toEqual([]);
    expect(resolveAnalyticsDestinationIds(false, {
      ...sharedEnv,
      NEXT_PUBLIC_GA_NON_PRODUCTION_IDS: `G-DEV12345,${PRODUCTION_ANALYTICS_IDS[1]}`,
    })).toEqual(['G-DEV12345']);
  });

  it('uses configured or default production IDs in production', () => {
    expect(resolveAnalyticsDestinationIds(true, {})).toEqual([...PRODUCTION_ANALYTICS_IDS]);
    expect(resolveAnalyticsDestinationIds(true, sharedEnv)).toEqual(['GT-5TCMV7L2', 'G-1159TDRHXC']);
  });

  it('drops values that are not plain tag IDs (they are inlined into a script)', () => {
    expect(resolveAnalyticsDestinationIds(true, { NEXT_PUBLIC_GA_MEASUREMENT_ID: "G-ABC123');alert(1)//" }))
      .toEqual([...PRODUCTION_ANALYTICS_IDS]);
  });
});

describe('site identity: redirect map and headers', () => {
  it('redirects every legacy host in one hop to the same path on drawordie.app', () => {
    const redirects = buildLegacyRedirects();
    expect(redirects).toHaveLength(LEGACY_HOSTS.length);

    for (const host of LEGACY_HOSTS) {
      const matching = redirects.filter((rule) => rule.has.some((cond) => hostMatches(cond.value, host)));
      expect(matching).toHaveLength(1);
      expect(matching[0]).toMatchObject({
        source: '/:path*',
        destination: 'https://drawordie.app/:path*',
        permanent: true,
      });
    }

    // The destination host must not itself be caught by a legacy rule (no chains / loops).
    expect(redirects.some((rule) => rule.has.some((cond) => hostMatches(cond.value, 'drawordie.app')))).toBe(false);
    expect(redirects.some((rule) => rule.has.some((cond) => hostMatches(cond.value, 'dev.drawordie.app'))))
      .toBe(false);
  });

  it('sends X-Robots-Tag noindex to every host except drawordie.app on a production build', () => {
    const [rule] = buildSearchIdentityHeaders(PROD_ENV);
    expect(rule.headers).toEqual([{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]);
    const [missing] = rule.missing ?? [];
    expect(hostMatches(missing.value, 'drawordie.app')).toBe(true);
    expect(hostMatches(missing.value, 'dev.drawordie.app')).toBe(false);
    expect(hostMatches(missing.value, 'drawordieXapp')).toBe(false);
  });

  it('sends X-Robots-Tag noindex on every host for preview/dev builds', () => {
    const [rule] = buildSearchIdentityHeaders({ NODE_ENV: 'production', VERCEL_ENV: 'preview' });
    expect(rule.missing).toBeUndefined();
    expect(rule.source).toBe('/:path*');
  });

  it('is wired into next.config', async () => {
    expect(await nextConfig.redirects?.()).toEqual(buildLegacyRedirects());
    const configHeaders = (await nextConfig.headers?.()) ?? [];
    expect(configHeaders).toEqual(expect.arrayContaining(buildSearchIdentityHeaders()));
  });
});
