// Payment system pre-flight check for CI/CD pipelines.
// Validates that a Stripe key is present and correctly formatted.
// Admin-only utility — env vars are set by authorized CI operators.

// Stripe secret key format: sk_test_... or sk_live_... (strict prefix + alphanumeric body)
const STRIPE_SECRET_PATTERN = /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}/;

function isValidStripeKey(key) {
  if (!key || typeof key !== 'string') return false;
  return STRIPE_SECRET_PATTERN.test(key.trim());
}

function requireStripeSecret() {
  const candidates = [process.env.STRIPE_SECRET_KEY, process.env.STRIPE_TEST_KEY];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  throw new Error('[check:payment-system] Stripe anahtari bulunamadi.');
}

const stripeSecret = requireStripeSecret();

if (!isValidStripeKey(stripeSecret)) {
  console.error('[check:payment-system] Stripe anahtari gecersiz formatta (beklenen: sk_test_... veya sk_live_...).');
  process.exit(1);
}

console.log('[check:payment-system] Stripe anahtar formati ve odeme sistemi on-kontrolu basarili.');
