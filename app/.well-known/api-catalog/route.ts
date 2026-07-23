const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://drawordie.ackaraca.me';

const headers = {
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  'Content-Type': 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
} as const;

function createCatalogBody(): string {
  return JSON.stringify({
    linkset: [
      {
        anchor: `${siteUrl}/.well-known/api-catalog`,
        item: [
          { href: `${siteUrl}/api/ai-generate` },
          { href: `${siteUrl}/api/analysis-history` },
          { href: `${siteUrl}/api/billing/history` },
          { href: `${siteUrl}/api/billing/portal` },
          { href: `${siteUrl}/api/gallery` },
          { href: `${siteUrl}/api/health` },
          { href: `${siteUrl}/api/mentor/chats` },
          { href: `${siteUrl}/api/profile` },
        ],
      },
    ],
  });
}

export function GET(): Response {
  return new Response(createCatalogBody(), { headers });
}

export function HEAD(): Response {
  return new Response(null, {
    headers,
  });
}
