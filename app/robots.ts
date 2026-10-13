import { headers } from 'next/headers';

import { PRODUCTION_ORIGIN, ROBOTS_DISALLOWED_PATHS, isProductionRequestHeaders } from '@/lib/site-identity';

import type { MetadataRoute } from 'next';

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!isProductionRequestHeaders(await headers())) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [...ROBOTS_DISALLOWED_PATHS] }],
    sitemap: `${PRODUCTION_ORIGIN}/sitemap.xml`,
    host: PRODUCTION_ORIGIN,
  };
}
