// Health-check script for CI/CD.
// Endpoint is chosen from a fixed allow-list to prevent SSRF.

const ENDPOINTS = Object.freeze({
  production: 'https://drawordie.app/api/health',
  staging: 'https://dev.drawordie.app/api/health',
});
const MAX_ATTEMPTS = 20;
const RETRY_DELAY_MS = 10_000;

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
const expectedReleaseSha = String(process.env.EXPECTED_RELEASE_SHA ?? '').trim().toLowerCase();
const expectedDeploymentId = String(process.env.EXPECTED_DEPLOYMENT_ID ?? '').trim();

if (!/^[a-f0-9]{40}$/.test(expectedReleaseSha)) {
  console.error('[validate:health-check] EXPECTED_RELEASE_SHA must be a 40-character hexadecimal commit SHA.');
  process.exit(1);
}

if (!/^[a-z0-9._:-]{1,128}$/i.test(expectedDeploymentId)) {
  console.error('[validate:health-check] EXPECTED_DEPLOYMENT_ID is missing or malformed.');
  process.exit(1);
}

let isVerified = false;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`${endpoint} returned HTTP ${response.status}.`);
    }

    const payload = await response.json();
    if (payload.status !== 'ok') {
      throw new Error('Expected status=ok.');
    }

    if (payload.release?.sha !== expectedReleaseSha) {
      throw new Error('Release SHA mismatch.');
    }

    if (payload.release?.deploymentId !== expectedDeploymentId) {
      throw new Error('Deployment ID mismatch.');
    }

    isVerified = true;
    break;
  } catch {
    if (attempt < MAX_ATTEMPTS) {
      console.warn(`[validate:health-check] Attempt ${attempt}/${MAX_ATTEMPTS} did not match the expected release.`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

if (!isVerified) {
  console.error(`[validate:health-check] Verification failed after ${MAX_ATTEMPTS} attempts.`);
  process.exit(1);
}

console.log('[validate:health-check] Verified the expected release identity.');
