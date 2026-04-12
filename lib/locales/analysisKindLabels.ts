import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

/** Labels for `analysisKind` in history and gallery cards. */
export function analysisKindLabel(kind: string, language: SupportedLanguage): string {
  switch (kind) {
    case 'SINGLE_JURY':
      return pickLocalized(language, 'Tek Jüri', 'Single jury');
    case 'REVISION_SAME':
      return pickLocalized(language, 'Revizyon', 'Revision');
    case 'MULTI_JURY':
      return pickLocalized(language, 'Çoklu Jüri', 'Multi jury');
    case 'PREMIUM_RESCUE':
      return pickLocalized(language, 'Premium Rescue', 'Premium Rescue');
    case 'AUTO_CONCEPT':
      return pickLocalized(language, 'Konsept Üretimi', 'Concept generation');
    case 'MATERIAL_BOARD':
      return pickLocalized(language, 'Malzeme Paftası', 'Material board');
    default:
      return kind.replace(/_/g, ' ');
  }
}
