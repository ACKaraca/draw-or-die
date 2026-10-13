import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

/** User-visible API strings for the account export/deletion routes. */
export const PrivacyApiMessages = {
  signInRequired: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Bu işlem için giriş yapmanız gerekiyor.', 'You must sign in to do this.'),
  rateLimited: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Çok fazla istek gönderildi. Bir saat sonra tekrar deneyin.',
      'Too many requests. Try again in an hour.',
    ),
  invalidBody: (lang: SupportedLanguage) =>
    pickLocalized(lang, 'Geçersiz istek gövdesi.', 'Invalid request body.'),
  confirmationRequired: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Hesap silme için açık onay gerekiyor. Onay alanını göndererek tekrar deneyin.',
      'Account deletion needs explicit confirmation. Resend the request with the confirmation field.',
    ),
  exportFailed: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Veri dışa aktarımı şu anda hazırlanamadı. Birkaç dakika sonra tekrar deneyin.',
      'Your data export could not be prepared right now. Try again in a few minutes.',
    ),
  deletionUnavailable: (lang: SupportedLanguage) =>
    pickLocalized(
      lang,
      'Silme talebi şu anda işlenemedi. Birkaç dakika sonra tekrar deneyin; talebiniz kaydedildiyse kaldığı yerden devam eder.',
      'The deletion request could not be processed right now. Try again in a few minutes; a recorded request resumes where it stopped.',
    ),
} as const;
