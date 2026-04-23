# Portfolio And Gallery API Contracts

## `/portfolio`

### POST
- **File:** `app/api/portfolio/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ portfolio: toPortfolioPayload(row`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ portfolios: rows.rows.map(toPortfolioPayload`
  - Status 200: `{ error: pickLocalized(lang`
- **Failure Modes:**
  - Standard 500s only or no specific failures

### GET
- **File:** `app/api/portfolio/route.ts`
- **Auth:** Requires authentication & User Profile
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized( lang`
  - Status 200: `{ portfolio: toPortfolioPayload(row`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ error: pickLocalized(lang`
  - Status 200: `{ portfolios: rows.rows.map(toPortfolioPayload`
  - Status 200: `{ error: pickLocalized(lang`
- **Failure Modes:**
  - Standard 500s only or no specific failures

## `/gallery`

### GET
- **File:** `app/api/gallery/route.ts`
- **Auth:** Requires authentication (`getAuthenticatedUserFromRequest`)
- **Rate Limits:** None
- **Request Schema:** None
- **Response Schema:**
  - Status 200: `{ items, total: result.total, }`
  - Status 200: `{ item: toGalleryItem(created`
  - Status 200: `{ item: toGalleryItem(updated`
- **Failure Modes:**
  - Status 401: `{ error: 'Kişisel galeri için giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: 'Galeri yüklenemedi.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'Geçersiz galeri verisi.', code: 'INVALID_GALLERY_PAYLOAD', }`
  - Status 400: `{ error: 'Community paylasimi icin pafta veya gorsel zorunlu.', code: 'COMMUNITY_IMAGE_REQUIRED', }`
  - Status 415: `{ error: 'Geçersiz görsel formatı. Sadece JPG/PNG/WEBP kabul edilir.', code: 'UNSUPPORTED_IMAGE_TYPE', }`
  - Status 400: `{ error: 'Görsel verisi bozuk.', code: 'INVALID_IMAGE_PAYLOAD', }`
  - Status 400: `{ error: 'Görsel verisi çözümlenemedi.', code: 'INVALID_IMAGE_PAYLOAD', }`
  - Status 413: `{ error: 'Galeri görseli 5MB sınırını aşıyor. Lütfen daha düşük çözünürlükte tekrar deneyin.', code: 'GALLERY_IMAGE_TOO_LARGE', }`
  - Status 422: `{ error: rejectionReason, code: 'COMMUNITY_MODERATION_REJECTED', moderationReason: rejectionReason, moderationCategory: moderation.category, }`
  - Status 500: `{ error: 'Galeriye ekleme başarısız.', code: 'GALLERY_WRITE_FAILED', }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 403: `{ error: 'Misafir hesaplar galeri görünürlüğünü yönetemez.' }`
  - Status 400: `{ error: 'Geçersiz galeri güncelleme isteği.' }`
  - Status 403: `{ error: 'Bu galeriyi yönetme yetkiniz yok.' }`
  - Status 500: `{ error: 'Galeri güncellenemedi.' }`

### POST
- **File:** `app/api/gallery/route.ts`
- **Auth:** Requires authentication (`getAuthenticatedUserFromRequest`)
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ items, total: result.total, }`
  - Status 200: `{ item: toGalleryItem(created`
  - Status 200: `{ item: toGalleryItem(updated`
- **Failure Modes:**
  - Status 401: `{ error: 'Kişisel galeri için giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: 'Galeri yüklenemedi.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'Geçersiz galeri verisi.', code: 'INVALID_GALLERY_PAYLOAD', }`
  - Status 400: `{ error: 'Community paylasimi icin pafta veya gorsel zorunlu.', code: 'COMMUNITY_IMAGE_REQUIRED', }`
  - Status 415: `{ error: 'Geçersiz görsel formatı. Sadece JPG/PNG/WEBP kabul edilir.', code: 'UNSUPPORTED_IMAGE_TYPE', }`
  - Status 400: `{ error: 'Görsel verisi bozuk.', code: 'INVALID_IMAGE_PAYLOAD', }`
  - Status 400: `{ error: 'Görsel verisi çözümlenemedi.', code: 'INVALID_IMAGE_PAYLOAD', }`
  - Status 413: `{ error: 'Galeri görseli 5MB sınırını aşıyor. Lütfen daha düşük çözünürlükte tekrar deneyin.', code: 'GALLERY_IMAGE_TOO_LARGE', }`
  - Status 422: `{ error: rejectionReason, code: 'COMMUNITY_MODERATION_REJECTED', moderationReason: rejectionReason, moderationCategory: moderation.category, }`
  - Status 500: `{ error: 'Galeriye ekleme başarısız.', code: 'GALLERY_WRITE_FAILED', }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 403: `{ error: 'Misafir hesaplar galeri görünürlüğünü yönetemez.' }`
  - Status 400: `{ error: 'Geçersiz galeri güncelleme isteği.' }`
  - Status 403: `{ error: 'Bu galeriyi yönetme yetkiniz yok.' }`
  - Status 500: `{ error: 'Galeri güncellenemedi.' }`

### PATCH
- **File:** `app/api/gallery/route.ts`
- **Auth:** Requires authentication (`getAuthenticatedUserFromRequest`)
- **Rate Limits:** None
- **Request Schema:** JSON Body Expected
- **Response Schema:**
  - Status 200: `{ items, total: result.total, }`
  - Status 200: `{ item: toGalleryItem(created`
  - Status 200: `{ item: toGalleryItem(updated`
- **Failure Modes:**
  - Status 401: `{ error: 'Kişisel galeri için giriş yapmanız gerekiyor.' }`
  - Status 500: `{ error: 'Galeri yüklenemedi.' }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 400: `{ error: 'Geçersiz galeri verisi.', code: 'INVALID_GALLERY_PAYLOAD', }`
  - Status 400: `{ error: 'Community paylasimi icin pafta veya gorsel zorunlu.', code: 'COMMUNITY_IMAGE_REQUIRED', }`
  - Status 415: `{ error: 'Geçersiz görsel formatı. Sadece JPG/PNG/WEBP kabul edilir.', code: 'UNSUPPORTED_IMAGE_TYPE', }`
  - Status 400: `{ error: 'Görsel verisi bozuk.', code: 'INVALID_IMAGE_PAYLOAD', }`
  - Status 400: `{ error: 'Görsel verisi çözümlenemedi.', code: 'INVALID_IMAGE_PAYLOAD', }`
  - Status 413: `{ error: 'Galeri görseli 5MB sınırını aşıyor. Lütfen daha düşük çözünürlükte tekrar deneyin.', code: 'GALLERY_IMAGE_TOO_LARGE', }`
  - Status 422: `{ error: rejectionReason, code: 'COMMUNITY_MODERATION_REJECTED', moderationReason: rejectionReason, moderationCategory: moderation.category, }`
  - Status 500: `{ error: 'Galeriye ekleme başarısız.', code: 'GALLERY_WRITE_FAILED', }`
  - Status 401: `{ error: 'Giriş yapmanız gerekiyor.' }`
  - Status 403: `{ error: 'Misafir hesaplar galeri görünürlüğünü yönetemez.' }`
  - Status 400: `{ error: 'Geçersiz galeri güncelleme isteği.' }`
  - Status 403: `{ error: 'Bu galeriyi yönetme yetkiniz yok.' }`
  - Status 500: `{ error: 'Galeri güncellenemedi.' }`
