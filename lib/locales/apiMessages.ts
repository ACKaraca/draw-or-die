import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

/** User-visible API error strings (JSON `error` field). */
export const ApiMessages = {
  signInRequired: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Giriş yapmanız gerekiyor.', 'You must sign in.'),
  rateLimited: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Çok fazla istek. Lütfen bekleyin.', 'Too many requests. Please wait.'),
  profileUnavailable: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Profil servisi şu anda kullanılamıyor.', 'Profile service is temporarily unavailable.'),
  profileFetchFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Profil alınamadı.', 'Could not load profile.'),
  invalidBody: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Geçersiz istek gövdesi.', 'Invalid request body.'),
  noFieldsToUpdate: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Güncellenecek alan bulunamadı.', 'No fields to update.'),
  profileUpdateFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Profil güncellenemedi.', 'Could not update profile.'),
  portalLinkFailed: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Abonelik yönetim bağlantısı oluşturulamadı.',
      'Could not create subscription management link.',
    ),
  billingHistoryFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Satın alım geçmişi alınamadı.', 'Could not load purchase history.'),
  checkoutStripeMissing: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Stripe yapılandırması eksik. Lütfen destekle iletişime geçin.',
      'Stripe is not configured. Please contact support.',
    ),
  checkoutInvalidMode: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Geçersiz checkout modu.', 'Invalid checkout mode.'),
  checkoutPriceInvalid: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Stripe fiyat konfigürasyonu geçersiz. Yönetici ile iletişime geçin.',
      'Stripe price configuration is invalid. Please contact an administrator.',
    ),
  checkoutCreateFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Checkout oluşturulamadı.', 'Could not create checkout.'),
  feedbackTooMany: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Çok fazla geri bildirim gönderildi. Lütfen bekleyin.', 'Too much feedback sent. Please wait.'),
  feedbackMessageShort: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Mesaj çok kısa.', 'Message is too short.'),
  feedbackMinLength: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Geri bildirim en az 8 karakter olmalı.',
      'Feedback must be at least 8 characters.',
    ),
  feedbackSaveFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Geri bildirim kaydedilemedi.', 'Could not save feedback.'),
  analysisHistoryFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Analiz geçmişi alınamadı.', 'Could not load analysis history.'),
  analysisSaveFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Analiz geçmişi kaydedilemedi.', 'Could not save analysis history.'),
  analysisNotFound: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Analiz kaydı bulunamadı.', 'Analysis record not found.'),
  analysisNotOwned: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Bu analiz kaydı size ait değil.', 'This analysis record does not belong to you.'),
  invalidBoardFormat: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Geçersiz pafta formatı. JPG/PNG/WEBP/PDF kabul edilir.',
      'Invalid board format. JPG/PNG/WEBP/PDF are accepted.',
    ),
  boardDecodeFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Pafta verisi çözümlenemedi.', 'Could not decode board data.'),
  boardTooLarge: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Pafta dosyası 35MB sınırını aşıyor.', 'Board file exceeds the 35MB limit.'),
  galleryLoadFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Galeri yüklenemedi.', 'Could not load gallery.'),
  galleryPersonalSignIn: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Kişisel galeri için giriş yapmanız gerekiyor.', 'Sign in to access your personal gallery.'),
  galleryInvalidPayload: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Geçersiz galeri verisi.', 'Invalid gallery payload.'),
  galleryInvalidImageFormat: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Geçersiz görsel formatı. Sadece JPG/PNG/WEBP kabul edilir.',
      'Invalid image format. Only JPG/PNG/WEBP are accepted.',
    ),
  galleryCorruptImage: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Görsel verisi bozuk.', 'Image data is corrupted.'),
  galleryImageDecodeFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Görsel verisi çözümlenemedi.', 'Could not decode image data.'),
  galleryImageTooLarge: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Galeri görseli 5MB sınırını aşıyor. Lütfen daha düşük çözünürlükte tekrar deneyin.',
      'Gallery image exceeds the 5MB limit. Try a lower resolution.',
    ),
  galleryAddFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Galeriye ekleme başarısız.', 'Could not add to gallery.'),
  galleryGuestCannotManage: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Misafir hesaplar galeri görünürlüğünü yönetemez.',
      'Guest accounts cannot manage gallery visibility.',
    ),
  galleryInvalidUpdate: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Geçersiz galeri güncelleme isteği.', 'Invalid gallery update request.'),
  galleryForbidden: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Bu galeriyi yönetme yetkiniz yok.', 'You are not allowed to manage this gallery entry.'),
  galleryUpdateFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Galeri güncellenemedi.', 'Could not update gallery.'),
  referralRewardFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Referral ödülü verilemedi.', 'Could not apply referral reward.'),
  referralLinkFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Referral linki alınamadı.', 'Could not load referral link.'),
  referralAttachFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Referral kodu bağlanamadı.', 'Could not attach referral code.'),
  eduOnlyEduTr: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Sadece .edu.tr uzantılı email adresleri kabul edilir.',
      'Only .edu.tr email addresses are accepted.',
    ),
  eduStartFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Doğrulama başlatılamadı.', 'Could not start verification.'),
  eduTooManyAttempts: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Çok fazla deneme. 10 dakika bekleyin.', 'Too many attempts. Wait 10 minutes.'),
  eduTooManyAttemptsShort: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Çok fazla deneme. Lütfen bekleyin.', 'Too many attempts. Please wait.'),
  eduCodeRequired: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Doğrulama kodu gereklidir.', 'Verification code is required.'),
  eduNotStarted: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Doğrulama başlatılmamış.', 'Verification has not been started.'),
  eduCodeExpired: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Doğrulama kodunun süresi dolmuş. Yeni kod gönderin.',
      'Verification code expired. Request a new code.',
    ),
  eduCodeInvalid: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Geçersiz doğrulama kodu.', 'Invalid verification code.'),
  eduCompleteFailed: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Doğrulama tamamlanamadı.', 'Could not complete verification.'),
} as const;
