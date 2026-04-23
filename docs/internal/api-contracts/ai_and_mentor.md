# Ai And Mentor API Contracts

## `/analysis-history`

### GET
- **File:** `app/api/analysis-history/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ items, total: result.total, }`
  - Status 200: `{ error: 'Yetersiz Rapido.'`
  - Status 200: `{ charged: preserveMode ? ANALYSIS_PRESERVE_COST_CENTS / RAPIDO_PRECISION_SCALE : 0`
  - Status 200: `{ error: 'Pafta dosyasi Appwrite bucket limitini asiyor. Lutfen daha dusuk boyutlu bir dosya deneyin.'`
  - Status 200: `{ success: true`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: 'Analiz geçmişi alınamadı.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'Eksik analiz verisi.' }`
  - Status 415: `{ error: 'Geçersiz pafta formatı. JPG/PNG/WEBP/PDF kabul edilir.' }`
  - Status 400: `{ error: 'Pafta verisi bozuk.' }`
  - Status 400: `{ error: 'Pafta verisi çözümlenemedi.' }`
  - Status 413: `{ error: 'Pafta dosyası 35MB sınırını aşıyor.', code: 'BOARD_TOO_LARGE', }`
  - Status 500: `{ error: 'Analiz geçmişi kaydedilemedi.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'historyId gerekli.' }`
  - Status 404: `{ error: 'Analiz kaydı bulunamadı.' }`
  - Status 403: `{ error: 'Bu analiz kaydı size ait değil.' }`
  - Status 500: `{ error: 'Analiz silinemedi.' }`

### POST
- **File:** `app/api/analysis-history/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ items, total: result.total, }`
  - Status 200: `{ error: 'Yetersiz Rapido.'`
  - Status 200: `{ charged: preserveMode ? ANALYSIS_PRESERVE_COST_CENTS / RAPIDO_PRECISION_SCALE : 0`
  - Status 200: `{ error: 'Pafta dosyasi Appwrite bucket limitini asiyor. Lutfen daha dusuk boyutlu bir dosya deneyin.'`
  - Status 200: `{ success: true`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: 'Analiz geçmişi alınamadı.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'Eksik analiz verisi.' }`
  - Status 415: `{ error: 'Geçersiz pafta formatı. JPG/PNG/WEBP/PDF kabul edilir.' }`
  - Status 400: `{ error: 'Pafta verisi bozuk.' }`
  - Status 400: `{ error: 'Pafta verisi çözümlenemedi.' }`
  - Status 413: `{ error: 'Pafta dosyası 35MB sınırını aşıyor.', code: 'BOARD_TOO_LARGE', }`
  - Status 500: `{ error: 'Analiz geçmişi kaydedilemedi.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'historyId gerekli.' }`
  - Status 404: `{ error: 'Analiz kaydı bulunamadı.' }`
  - Status 403: `{ error: 'Bu analiz kaydı size ait değil.' }`
  - Status 500: `{ error: 'Analiz silinemedi.' }`

### DELETE
- **File:** `app/api/analysis-history/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ items, total: result.total, }`
  - Status 200: `{ error: 'Yetersiz Rapido.'`
  - Status 200: `{ charged: preserveMode ? ANALYSIS_PRESERVE_COST_CENTS / RAPIDO_PRECISION_SCALE : 0`
  - Status 200: `{ error: 'Pafta dosyasi Appwrite bucket limitini asiyor. Lutfen daha dusuk boyutlu bir dosya deneyin.'`
  - Status 200: `{ success: true`
- **Failure Modes:**
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: 'Analiz geçmişi alınamadı.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'Eksik analiz verisi.' }`
  - Status 415: `{ error: 'Geçersiz pafta formatı. JPG/PNG/WEBP/PDF kabul edilir.' }`
  - Status 400: `{ error: 'Pafta verisi bozuk.' }`
  - Status 400: `{ error: 'Pafta verisi çözümlenemedi.' }`
  - Status 413: `{ error: 'Pafta dosyası 35MB sınırını aşıyor.', code: 'BOARD_TOO_LARGE', }`
  - Status 500: `{ error: 'Analiz geçmişi kaydedilemedi.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'historyId gerekli.' }`
  - Status 404: `{ error: 'Analiz kaydı bulunamadı.' }`
  - Status 403: `{ error: 'Bu analiz kaydı size ait değil.' }`
  - Status 500: `{ error: 'Analiz silinemedi.' }`

## `/analysis-history/recover`

### POST
- **File:** `app/api/analysis-history/recover/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ error: 'Yetersiz Rapido.'`
  - Status 200: `{ charged: BOARD_RECOVERY_COST_CENTS / RAPIDO_PRECISION_SCALE`
- **Failure Modes:**
  - Status 401: `{ error: 'Giris yapmaniz gerekiyor.' }`
  - Status 400: `{ error: 'historyId gerekli.' }`
  - Status 404: `{ error: 'Analiz kaydi bulunamadi.' }`
  - Status 403: `{ error: 'Bu analiz kaydi size ait degil.' }`
  - Status 500: `{ error: 'Kayitli pano geri yuklenemedi.' }`

## `/ai-generate`

### POST
- **File:** `app/api/ai-generate/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** Yes: `...aiRateLimit, maxRequests: aiRateLimit.maxRequests * 4`
- **Request Schema:** JSON Body: `body`
- **Response Schema:**
  - Status 200: `{ requestId, ...payload }`
- **Failure Modes:**
  - Standard 500s only or no specific failures

## `/mentor/chats`

### GET
- **File:** `app/api/mentor/chats/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ items: result.rows.map(toChatDto`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ item: toChatDto(chat`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ success: true }`
  - Status 200: `{ error: pickLocalized(headerLang`
- **Failure Modes:**
  - Standard 500s only or no specific failures

### POST
- **File:** `app/api/mentor/chats/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ items: result.rows.map(toChatDto`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ item: toChatDto(chat`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ success: true }`
  - Status 200: `{ error: pickLocalized(headerLang`
- **Failure Modes:**
  - Standard 500s only or no specific failures

### DELETE
- **File:** `app/api/mentor/chats/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ items: result.rows.map(toChatDto`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ item: toChatDto(chat`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ error: pickLocalized(headerLang`
  - Status 200: `{ success: true }`
  - Status 200: `{ error: pickLocalized(headerLang`
- **Failure Modes:**
  - Standard 500s only or no specific failures
