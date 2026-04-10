// Stripe configuration validator for CI/CD pipelines.
// Checks that required environment variables are present and correctly formatted.
// This is an admin-only utility — env vars are set by authorized operators.

const ALLOWED_SECRET_PREFIXES = ['sk_live_', 'sk_test_', 'rk_live_', 'rk_test_'];

function isValidStripeSecretKey(key) {
  if (!key || typeof key !== 'string') return false;
  return ALLOWED_SECRET_PREFIXES.some((prefix) => key.startsWith(prefix));
}

const stripeSecret = String(process.env.STRIPE_SECRET_KEY ?? '').trim();
const stripeTest = String(process.env.STRIPE_TEST_KEY ?? '').trim();
const stripePublic = String(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY ?? '').trim();

const hasSecret = isValidStripeSecretKey(stripeSecret);
const hasTest = isValidStripeSecretKey(stripeTest);

if (!hasSecret && !hasTest) {
  console.error(
    '[check:stripe-config] STRIPE_SECRET_KEY veya STRIPE_TEST_KEY gecerli formatta olmali (sk_test_ / sk_live_).',
  );
  process.exit(1);
}

if (stripeSecret.startsWith('sk_live_')) {
  console.warn('[check:stripe-config] sk_live_ anahtari tespit edildi. Yalnizca production ortaminda kullanilmali.');
}

if (stripePublic && stripePublic.startsWith('sk_')) {
  console.error('[check:stripe-config] NEXT_PUBLIC_STRIPE_PUBLIC_KEY gizli anahtar olamaz.');
  process.exit(1);
}

console.log('[check:stripe-config] Stripe anahtar dogrulamasi basarili.');
