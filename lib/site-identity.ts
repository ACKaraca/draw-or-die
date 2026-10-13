// Single source of truth for the public search identity: canonical domain, legacy domains, which deployment counts
// as production, and which analytics IDs a deployment may load. Kept dependency-free so next.config.ts can import it.

export const PRODUCTION_HOST = 'drawordie.app';
export const PRODUCTION_ORIGIN = `https://${PRODUCTION_HOST}`;

/** Hosts that must answer with exactly one permanent redirect to the same path on PRODUCTION_ORIGIN. */
export const LEGACY_HOSTS = ['drawordie.ackaraca.me', 'www.drawordie.app'] as const;

/** Production Google tag / GA4 destinations. Must never load outside production. */
export const PRODUCTION_ANALYTICS_IDS = ['GT-5TCMV7L2', 'G-1159TDRHXC', 'G-53LBVDCHC6'] as const;

/** Static, non-user-generated public routes. Gallery/community/confession/peer-review pages carry user content
 * and stay out of the sitemap until per-item consent + moderation approval is modelled. */
export const PUBLIC_SITEMAP_PATHS = [
  '/',
  '/archbuilder',
  '/mentor',
  '/portfolio',
  '/legal',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
] as const;

/** Account, admin and API surfaces crawlers should not fetch on production. */
export const ROBOTS_DISALLOWED_PATHS = ['/api/', '/auth/', '/profile', '/history', '/references/admin'] as const;

export const NOINDEX_HEADER_VALUE = 'noindex, nofollow';

export type SiteEnv = Partial<Record<
  | 'NODE_ENV'
  | 'VERCEL_ENV'
  | 'SITE_ENV'
  | 'NEXT_PUBLIC_APP_URL'
  | 'NEXT_PUBLIC_GOOGLE_TAG_ID'
  | 'NEXT_PUBLIC_GA_MEASUREMENT_ID'
  | 'NEXT_PUBLIC_GA_SECONDARY_MEASUREMENT_ID'
  | 'NEXT_PUBLIC_GA_DESTINATION_IDS'
  | 'NEXT_PUBLIC_GA_NON_PRODUCTION_IDS',
  string | undefined
>>;

type HeaderReader = { get(name: string): string | null };

type HostCondition = { type: 'host'; value: string };

export type RedirectRule = {
  source: string;
  has: HostCondition[];
  destination: string;
  permanent: true;
};

export type HeaderRule = {
  source: string;
  missing?: HostCondition[];
  headers: { key: string; value: string }[];
};

function readEnv(env: SiteEnv, key: keyof SiteEnv): string {
  return (env[key] ?? '').trim().toLowerCase();
}

function escapeHostPattern(host: string): string {
  return host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// IDs end up inside an inline <script>; anything that is not a plain Google tag ID is dropped.
const ANALYTICS_ID_PATTERN = /^[A-Z]{1,3}-[A-Z0-9]{4,20}$/;

function parseIds(rawValue: string | undefined): string[] {
  if (!rawValue) return [];
  return rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => ANALYTICS_ID_PATTERN.test(value));
}

/** Lowercased host without port; the first entry wins when a proxy sends a comma-separated list. */
export function normalizeHost(rawHost: string | null | undefined): string | null {
  if (!rawHost) return null;
  const first = rawHost.split(',')[0]?.trim().toLowerCase() ?? '';
  const withoutPort = first.replace(/:\d+$/, '').replace(/\.$/, '');
  return withoutPort || null;
}

export function isLegacyHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  return normalized !== null && (LEGACY_HOSTS as readonly string[]).includes(normalized);
}

/**
 * Build-level check. VERCEL_ENV and SITE_ENV act as vetoes when set (Vercel preview, Appwrite dev site);
 * neither alone can promote a deployment, the request host must match too (see isProductionRequest).
 */
export function isProductionDeployment(env: SiteEnv = process.env): boolean {
  const vercelEnv = readEnv(env, 'VERCEL_ENV');
  if (vercelEnv && vercelEnv !== 'production') return false;

  const siteEnv = readEnv(env, 'SITE_ENV');
  if (siteEnv && siteEnv !== 'production') return false;

  return readEnv(env, 'NODE_ENV') === 'production';
}

export function isProductionRequest(host: string | null | undefined, env: SiteEnv = process.env): boolean {
  return isProductionDeployment(env) && normalizeHost(host) === PRODUCTION_HOST;
}

export function resolveRequestHost(headerStore: HeaderReader): string | null {
  return normalizeHost(headerStore.get('x-forwarded-host') ?? headerStore.get('host'));
}

export function isProductionRequestHeaders(headerStore: HeaderReader, env: SiteEnv = process.env): boolean {
  return isProductionRequest(resolveRequestHost(headerStore), env);
}

/** Origin for metadataBase outside production; legacy or malformed values fall back to the production origin. */
export function resolveSiteUrl(env: SiteEnv = process.env): string {
  const raw = (env.NEXT_PUBLIC_APP_URL ?? '').trim();
  if (!raw) return PRODUCTION_ORIGIN;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return PRODUCTION_ORIGIN;
    if (isLegacyHost(url.host)) return PRODUCTION_ORIGIN;
    return url.origin;
  } catch {
    return PRODUCTION_ORIGIN;
  }
}

export function resolveMetadataBase(isProduction: boolean, env: SiteEnv = process.env): URL {
  return new URL(isProduction ? PRODUCTION_ORIGIN : resolveSiteUrl(env));
}

export function buildRobotsMetadata(isProduction: boolean): { index: boolean; follow: boolean } | undefined {
  return isProduction ? undefined : { index: false, follow: false };
}

/**
 * Production loads the configured (or default) production destinations. Every other deployment only loads
 * NEXT_PUBLIC_GA_NON_PRODUCTION_IDS, with production IDs stripped so shared env vars cannot leak into dev data.
 */
export function resolveAnalyticsDestinationIds(isProduction: boolean, env: SiteEnv = process.env): string[] {
  if (!isProduction) {
    const productionIds = new Set<string>(PRODUCTION_ANALYTICS_IDS);
    return Array.from(new Set(parseIds(env.NEXT_PUBLIC_GA_NON_PRODUCTION_IDS))).filter(
      (id) => !productionIds.has(id),
    );
  }

  const configured = Array.from(new Set([
    ...parseIds(env.NEXT_PUBLIC_GOOGLE_TAG_ID),
    ...parseIds(env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    ...parseIds(env.NEXT_PUBLIC_GA_SECONDARY_MEASUREMENT_ID),
    ...parseIds(env.NEXT_PUBLIC_GA_DESTINATION_IDS),
  ]));

  return configured.length > 0 ? configured : [...PRODUCTION_ANALYTICS_IDS];
}

/** One hop per legacy host: same path and query on the production origin. */
export function buildLegacyRedirects(): RedirectRule[] {
  return LEGACY_HOSTS.map((host) => ({
    source: '/:path*',
    has: [{ type: 'host', value: escapeHostPattern(host) }],
    destination: `${PRODUCTION_ORIGIN}/:path*`,
    permanent: true,
  }));
}

/**
 * X-Robots-Tag for every host other than the production host; a non-production build (preview / dev site)
 * gets it on every host so a misrouted production domain alias can never be indexed from it.
 */
export function buildSearchIdentityHeaders(env: SiteEnv = process.env): HeaderRule[] {
  const noindexHeader = [{ key: 'X-Robots-Tag', value: NOINDEX_HEADER_VALUE }];

  if (!isProductionDeployment(env)) {
    return [{ source: '/:path*', headers: noindexHeader }];
  }

  return [{
    source: '/:path*',
    missing: [{ type: 'host', value: escapeHostPattern(PRODUCTION_HOST) }],
    headers: noindexHeader,
  }];
}
