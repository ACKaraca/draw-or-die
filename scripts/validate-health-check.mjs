// Health-check script for CI/CD.
// Endpoint is chosen from a fixed allow-list to prevent SSRF.

const ENDPOINTS = Object.freeze({
  production: 'https://www.draw-or-die.com/api/health',
  staging: 'https://draw-or-die.vercel.app/api/health',
});

function resolveEndpoint() {
  const explicit = String(process.env.HEALTHCHECK_TARGET ?? '').trim().toLowerCase();
  if (explicit === 'production' || explicit === 'staging') {
    return ENDPOINTS[explicit];
  }

  const env = String(process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? '').trim().toLowerCase();
  if (env === 'production') return ENDPOINTS.production;
  return ENDPOINTS.staging;
}

const endpoint = resolveEndpoint();

try {
  const response = await fetch(endpoint, { method: 'GET' });
  if (!response.ok) {
    console.error(`[validate:health-check] ${endpoint} yaniti hatali: ${response.status}`);
    process.exit(1);
  }

  const payload = await response.json().catch(() => ({}));
  if (payload.status !== 'ok') {
    console.error('[validate:health-check] Beklenen status=ok donmedi.');
    process.exit(1);
  }

  console.log('[validate:health-check] Health check basarili.');
} catch (error) {
  console.error(
    '[validate:health-check] Istek basarisiz:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
}
