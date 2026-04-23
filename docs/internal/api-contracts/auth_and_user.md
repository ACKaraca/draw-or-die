# Auth And User API Contracts

## `/profile`

### GET
- **File:** `app/api/profile/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ error: ApiMessages.profileUnavailable(lang`
  - Status 200: `{ error: ApiMessages.signInRequired(lang`
  - Status 200: `{ profile: { ...profile, referral_signup_count: referralSignupCount, }, }`
  - Status 200: `{ error: ApiMessages.profileFetchFailed(lang`
  - Status 200: `{ error: ApiMessages.profileUnavailable(lang`
  - Status 200: `{ error: ApiMessages.signInRequired(lang`
  - Status 200: `{ error: ApiMessages.invalidBody(lang`
  - Status 200: `{ error: ApiMessages.noFieldsToUpdate(lang`
  - Status 200: `{ profile }`
  - Status 200: `{ error: ApiMessages.profileUpdateFailed(lang`
- **Failure Modes:**
  - Standard 500s only or no specific failures

### PATCH
- **File:** `app/api/profile/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body: `body`
- **Response Schema:**
  - Status 200: `{ error: ApiMessages.profileUnavailable(lang`
  - Status 200: `{ error: ApiMessages.signInRequired(lang`
  - Status 200: `{ profile: { ...profile, referral_signup_count: referralSignupCount, }, }`
  - Status 200: `{ error: ApiMessages.profileFetchFailed(lang`
  - Status 200: `{ error: ApiMessages.profileUnavailable(lang`
  - Status 200: `{ error: ApiMessages.signInRequired(lang`
  - Status 200: `{ error: ApiMessages.invalidBody(lang`
  - Status 200: `{ error: ApiMessages.noFieldsToUpdate(lang`
  - Status 200: `{ profile }`
  - Status 200: `{ error: ApiMessages.profileUpdateFailed(lang`
- **Failure Modes:**
  - Standard 500s only or no specific failures

## `/profile/stats`

### GET
- **File:** `app/api/profile/stats/route.ts`
- **Auth:** Requires authentication (`getAuthenticatedUserFromRequest`)
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `cached`
  - Status 200: `responsePayload`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: 'Profil istatistikleri alınamadı.' }`

## `/auth/signup-precheck`

### POST
- **File:** `app/api/auth/signup-precheck/route.ts`
- **Auth:** None
- **Rate Limits:** Yes: `maxRequests: 15, windowMs: 60 * 1000,`
- **Request Schema:** JSON Body: `rawBody`
- **Response Schema:**
  - Status 200: `{ canonicalEmail: normalized.canonicalEmail, gmailCanonicalized: normalized.gmailCanonicalized, }`
- **Failure Modes:**
  - Status 400: `{ error: 'Gecerli bir email adresi girin.' }`
  - Status 429: `{ error: 'Cok fazla kayit denemesi. Lutfen tekrar deneyin.' }`
  - Status 409: `{ error: 'Bu Gmail adresinin noktasiz surumu daha once kaydolmus.', code: 'GMAIL_CANONICAL_CONFLICT', canonicalEmail: normalized.canonicalEmail, }`
  - Status 500: `{ error: 'Kayit on kontrolu yapilamadi.' }`

## `/verify-edu`

### POST
- **File:** `app/api/verify-edu/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** Yes: `maxRequests: 3, windowMs: 10 * 60 * 1000`
- **Request Schema:** JSON Body: `body`
- **Response Schema:**
  - Status 200: `{ message: deliveredByEmail ? `Dogrulama kodu ${email} adresine gonderildi.` : `Dogrulama kodu olusturuldu. ${email} icin manuel kod girerek devam ...`
  - Status 200: `{ message: '.edu.tr email doğrulandı! Öğrenci indirimi aktif.', verified: true }`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 429: `{ error: 'Çok fazla deneme. 10 dakika bekleyin.' }`
  - Status 400: `{ error: 'Email adresi gereklidir.' }`
  - Status 400: `{ error: 'Sadece .edu.tr uzantılı email adresleri kabul edilir.' }`
  - Status 500: `{ error: 'Doğrulama başlatılamadı.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 429: `{ error: 'Çok fazla deneme. Lütfen bekleyin.' }`
  - Status 400: `{ error: 'Doğrulama kodu gereklidir.' }`
  - Status 400: `{ error: 'Doğrulama başlatılmamış.' }`
  - Status 400: `{ error: 'Doğrulama kodunun süresi dolmuş. Yeni kod gönderin.' }`
  - Status 400: `{ error: 'Geçersiz doğrulama kodu.' }`
  - Status 400: `{ error: 'Geçersiz doğrulama kodu.' }`
  - Status 500: `{ error: 'Doğrulama tamamlanamadı.' }`

### PUT
- **File:** `app/api/verify-edu/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** Yes: `maxRequests: 3, windowMs: 10 * 60 * 1000`
- **Request Schema:** JSON Body: `body`
- **Response Schema:**
  - Status 200: `{ message: deliveredByEmail ? `Dogrulama kodu ${email} adresine gonderildi.` : `Dogrulama kodu olusturuldu. ${email} icin manuel kod girerek devam ...`
  - Status 200: `{ message: '.edu.tr email doğrulandı! Öğrenci indirimi aktif.', verified: true }`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 429: `{ error: 'Çok fazla deneme. 10 dakika bekleyin.' }`
  - Status 400: `{ error: 'Email adresi gereklidir.' }`
  - Status 400: `{ error: 'Sadece .edu.tr uzantılı email adresleri kabul edilir.' }`
  - Status 500: `{ error: 'Doğrulama başlatılamadı.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 429: `{ error: 'Çok fazla deneme. Lütfen bekleyin.' }`
  - Status 400: `{ error: 'Doğrulama kodu gereklidir.' }`
  - Status 400: `{ error: 'Doğrulama başlatılmamış.' }`
  - Status 400: `{ error: 'Doğrulama kodunun süresi dolmuş. Yeni kod gönderin.' }`
  - Status 400: `{ error: 'Geçersiz doğrulama kodu.' }`
  - Status 400: `{ error: 'Geçersiz doğrulama kodu.' }`
  - Status 500: `{ error: 'Doğrulama tamamlanamadı.' }`
