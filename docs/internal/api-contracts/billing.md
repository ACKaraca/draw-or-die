# Billing API Contracts

## `/checkout`

### POST
- **File:** `app/api/checkout/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ url: session.url }`
- **Failure Modes:**
  - Status 503: `{ error: 'Stripe yapılandırması eksik. Lütfen destekle iletişime geçin.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 429: `{ error: 'Çok fazla istek. Lütfen bekleyin.' }`
  - Status 400: `{ error: 'Geçersiz checkout modu.' }`
  - Status 400: `{ error: internalPromo.error, code: internalPromo.code }`
  - Status 400: `{ error: 'Promo kodu gecersiz veya suresi dolmus.', code: 'INVALID_PROMO_CODE', }`
  - Status 503: `{ error: 'Stripe fiyat konfigürasyonu geçersiz. Yönetici ile iletişime geçin.' }`
  - Status 500: `{ error: 'Checkout oluşturulamadı.' }`

## `/checkout/validate-promo`

### POST
- **File:** `app/api/checkout/validate-promo/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `internal`
  - Status 200: `{ valid: true`
- **Failure Modes:**
  - Status 401: `{ error: 'Giris yapmaniz gerekiyor.' }`
  - Status 429: `{ error: 'Cok fazla istek. Lutfen bekleyin.' }`
  - Status 400: `{ valid: false, error: 'Promo kodu gerekli.', code: 'PROMO_REQUIRED' }`
  - Status 400: `{ valid: false, error: internal.error, code: internal.code, }`
  - Status 404: `{ valid: false, error: 'Promo kodu gecersiz veya suresi dolmus.', code: 'INVALID_PROMO_CODE', }`
  - Status 400: `{ valid: false, error: 'Promo kodu su an dogrulanamiyor.', code: 'PROMO_VALIDATION_FAILED', }`
  - Status 500: `{ valid: false, error: 'Promo kodu dogrulanamadi.' }`

## `/webhook/stripe`

### POST
- **File:** `app/api/webhook/stripe/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ received: true }`
  - Status 200: `{ received: true }`
- **Failure Modes:**
  - Status 400: `{ error: 'Missing stripe-signature header' }`
  - Status 400: `{ error: 'Webhook signature verification failed' }`
  - Status 500: `{ error: 'Webhook handler failed' }`

## `/promos/redeem`

### POST
- **File:** `app/api/promos/redeem/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ ok: true, message: result.message, promoCode: result.promo.code, rewardKind: result.promo.rewardKind, rewardValue: result.promo.rewardValue, rapi...`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 429: `{ error: 'Çok fazla istek. Lütfen bekleyin.' }`
  - Status 400: `{ ok: false, error: 'Promo kodu gerekli.', code: 'PROMO_REQUIRED' }`
  - Status 400: `result`
  - Status 500: `{ ok: false, error: 'Promo kodu redeem edilemedi.' }`

## `/billing/history`

### GET
- **File:** `app/api/billing/history/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ membership: { isPremium: profile.is_premium`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: 'Satın alım geçmişi alınamadı.' }`

## `/billing/portal`

### POST
- **File:** `app/api/billing/portal/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ url: session.url }`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 429: `{ error: 'Çok fazla istek. Lütfen bekleyin.' }`
  - Status 400: `{ error: 'Bu hesap icin Stripe musteri kaydi bulunamadi.', code: 'NO_STRIPE_CUSTOMER', }`
  - Status 400: `{ error: 'Abonelik yönetim bağlantısı oluşturulamadı.', code: 'PORTAL_SESSION_FAILED', }`
  - Status 500: `{ error: 'Abonelik yönetim bağlantısı oluşturulamadı.' }`
