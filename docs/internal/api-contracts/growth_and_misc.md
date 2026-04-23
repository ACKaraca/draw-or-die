# Growth And Misc API Contracts

## `/memory-snippets`

### GET
- **File:** `app/api/memory-snippets/route.ts`
- **Auth:** Requires authentication (`getAuthenticatedUserFromRequest`)
- **Rate Limits:** None
- **Request Schema:** URL Query Parameters: 'includeContext'
- **Response Schema:**
  - Status 200: `{ items }`
  - Status 200: `{ items, context }`
  - Status 200: `{ success: true }`
- **Failure Modes:**
  - Status 401: `{ error: 'Giris yapmaniz gerekiyor.' }`
  - Status 500: `{ error: 'AI hafiza notlari alinamadi.' }`
  - Status 401: `{ error: 'Giris yapmaniz gerekiyor.' }`
  - Status 400: `{ error: 'snippetId gerekli.' }`
  - Status 400: `{ error: 'Silme nedeni gerekli.' }`
  - Status 400: `{ error: 'Gecersiz silme nedeni.' }`
  - Status 404: `{ error: 'Hafiza notu bulunamadi.' }`
  - Status 403: `{ error: 'Bu hafiza notu size ait degil.' }`
  - Status 403: `{ error: 'Bu kategori silinemez.' }`
  - Status 500: `{ error: 'Hafiza notu silinemedi.' }`

### DELETE
- **File:** `app/api/memory-snippets/route.ts`
- **Auth:** Requires authentication (`getAuthenticatedUserFromRequest`)
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ items }`
  - Status 200: `{ items, context }`
  - Status 200: `{ success: true }`
- **Failure Modes:**
  - Status 401: `{ error: 'Giris yapmaniz gerekiyor.' }`
  - Status 500: `{ error: 'AI hafiza notlari alinamadi.' }`
  - Status 401: `{ error: 'Giris yapmaniz gerekiyor.' }`
  - Status 400: `{ error: 'snippetId gerekli.' }`
  - Status 400: `{ error: 'Silme nedeni gerekli.' }`
  - Status 400: `{ error: 'Gecersiz silme nedeni.' }`
  - Status 404: `{ error: 'Hafiza notu bulunamadi.' }`
  - Status 403: `{ error: 'Bu hafiza notu size ait degil.' }`
  - Status 403: `{ error: 'Bu kategori silinemez.' }`
  - Status 500: `{ error: 'Hafiza notu silinemedi.' }`

## `/client-log`

### POST
- **File:** `app/api/client-log/route.ts`
- **Auth:** None
- **Rate Limits:** Yes: `maxRequests: Math.max(30, RATE_LIMITS.GENERAL.maxRequests), windowMs: RATE_LIMITS.GENERAL.windowMs,`
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ ok: true }`
- **Failure Modes:**
  - Status 429: `{ ok: false, error: 'Rate limit' }`
  - Status 400: `{ ok: false, error: 'Invalid log payload' }`

## `/growth/conversion`

### POST
- **File:** `app/api/growth/conversion/route.ts`
- **Auth:** None
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ ok: true }`
- **Failure Modes:**
  - Status 400: `{ ok: false, error: 'eventName is required' }`
  - Status 400: `{ ok: false, error: 'invalid payload' }`

## `/referral/link`

### GET
- **File:** `app/api/referral/link/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ referral_code: referralCode`
  - Status 200: `{ success: true }`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: 'Referral linki alınamadı.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'Referral kodu gerekli.' }`
  - Status 422: `{ error: result.error }`
  - Status 500: `{ error: 'Referral kodu bağlanamadı.' }`

### POST
- **File:** `app/api/referral/link/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body: `body`
- **Response Schema:**
  - Status 200: `{ referral_code: referralCode`
  - Status 200: `{ success: true }`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: 'Referral linki alınamadı.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'Referral kodu gerekli.' }`
  - Status 422: `{ error: result.error }`
  - Status 500: `{ error: 'Referral kodu bağlanamadı.' }`

## `/referral/apply`

### POST
- **File:** `app/api/referral/apply/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ success: true, rewarded: result.rewarded, rapido: result.rapido ?? null, }`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: result.error }`
  - Status 500: `{ error: 'Referral ödülü verilemedi.' }`

## `/confessions`

### POST
- **File:** `app/api/confessions/route.ts`
- **Auth:** None
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ error: 'Invalid anonKey length (8–64 chars required`
  - Status 200: `{ ok: true`
  - Status 200: `{ ok: true`
  - Status 200: `{ confessions, total: result.total ?? result.rows.length, }`
- **Failure Modes:**
  - Status 400: `{ error: 'Confession text must be between 10 and 2000 characters.', code: 'INVALID_TEXT_LENGTH' }`
  - Status 429: `{ error: 'Rate limit exceeded. You can submit up to 5 confessions per 24 hours.', code: 'RATE_LIMIT_EXCEEDED' }`
  - Status 415: `{ error: 'Invalid image MIME type. Only image/* types are allowed.', code: 'INVALID_IMAGE_MIME' }`
  - Status 400: `{ error: 'Malformed image data.', code: 'INVALID_IMAGE_PAYLOAD' }`
  - Status 413: `{ error: 'Image exceeds 2MB limit.', code: 'IMAGE_TOO_LARGE' }`
  - Status 500: `{ error: 'Failed to submit confession.', code: 'CONFESSION_WRITE_FAILED' }`
  - Status 500: `{ error: 'Failed to load confessions.', code: 'CONFESSION_READ_FAILED' }`

### GET
- **File:** `app/api/confessions/route.ts`
- **Auth:** None
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ error: 'Invalid anonKey length (8–64 chars required`
  - Status 200: `{ ok: true`
  - Status 200: `{ ok: true`
  - Status 200: `{ confessions, total: result.total ?? result.rows.length, }`
- **Failure Modes:**
  - Status 400: `{ error: 'Confession text must be between 10 and 2000 characters.', code: 'INVALID_TEXT_LENGTH' }`
  - Status 429: `{ error: 'Rate limit exceeded. You can submit up to 5 confessions per 24 hours.', code: 'RATE_LIMIT_EXCEEDED' }`
  - Status 415: `{ error: 'Invalid image MIME type. Only image/* types are allowed.', code: 'INVALID_IMAGE_MIME' }`
  - Status 400: `{ error: 'Malformed image data.', code: 'INVALID_IMAGE_PAYLOAD' }`
  - Status 413: `{ error: 'Image exceeds 2MB limit.', code: 'IMAGE_TOO_LARGE' }`
  - Status 500: `{ error: 'Failed to submit confession.', code: 'CONFESSION_WRITE_FAILED' }`
  - Status 500: `{ error: 'Failed to load confessions.', code: 'CONFESSION_READ_FAILED' }`
