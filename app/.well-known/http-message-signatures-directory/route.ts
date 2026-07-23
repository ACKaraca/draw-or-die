const JWKS = {
  keys: [
    {
      crv: 'Ed25519',
      kty: 'OKP',
      x: 'S1XPsooKYUCJJx5Jqd5my9_Wf0XNn3OxbCPXOsDYht8',
      use: 'sig',
      kid: '-AO5ykCHqRVt1LT6JYZsCU31UhWUOXkEpgJYnMleHvQ',
    },
  ],
} as const;

const headers = {
  'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  'Content-Type': 'application/http-message-signatures-directory+json',
} as const;

function createDirectoryBody(): string {
  return JSON.stringify(JWKS);
}

export function GET(): Response {
  return new Response(createDirectoryBody(), { headers });
}

export function HEAD(): Response {
  return new Response(null, {
    headers,
  });
}
