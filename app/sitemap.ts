import { headers } from 'next/headers';

import { PRODUCTION_ORIGIN, PUBLIC_SITEMAP_PATHS, isProductionRequestHeaders } from '@/lib/site-identity';

import type { MetadataRoute } from 'next';

type SitemapEntry = MetadataRoute.Sitemap[number];
type PublicPath = (typeof PUBLIC_SITEMAP_PATHS)[number];

const CHANGE_FREQUENCY: Record<PublicPath, SitemapEntry['changeFrequency']> = {
  '/': 'weekly',
  '/archbuilder': 'monthly',
  '/mentor': 'monthly',
  '/portfolio': 'monthly',
  '/legal': 'monthly',
  '/legal/terms': 'monthly',
  '/legal/privacy': 'monthly',
  '/legal/cookies': 'monthly',
};

function priorityFor(path: PublicPath): number {
  if (path === '/') return 1;
  return path.startsWith('/legal') ? 0.4 : 0.7;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Non-production hosts publish nothing: their robots.txt disallows crawling and names no sitemap.
  if (!isProductionRequestHeaders(await headers())) {
    return [];
  }

  return PUBLIC_SITEMAP_PATHS.map((path) => ({
    url: path === '/' ? `${PRODUCTION_ORIGIN}/` : `${PRODUCTION_ORIGIN}${path}`,
    changeFrequency: CHANGE_FREQUENCY[path],
    priority: priorityFor(path),
  }));
}
