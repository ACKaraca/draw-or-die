import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

/** User-facing label for a Rapido cost key (see `lib/pricing.ts` → RAPIDO_COSTS). */
export function rapidoCostOperationLabel(key: string, language: SupportedLanguage): string {
  switch (key) {
    case 'SINGLE_JURY':
      return pickLocalized(language, 'Tekli jüri', 'Single jury');
    case 'REVISION_SAME':
      return pickLocalized(language, 'Revizyon (aynı proje)', 'Revision (same project)');
    case 'REVISION_DIFFERENT':
      return pickLocalized(language, 'Revizyon (farklı proje)', 'Revision (different project)');
    case 'MULTI_JURY':
      return pickLocalized(language, 'Çoklu jüri', 'Multi jury');
    case 'MULTI_JURY_REVISION':
      return pickLocalized(language, 'Çoklu jüri revizyonu', 'Multi-jury revision');
    case 'AUTO_CONCEPT':
      return pickLocalized(language, 'Otomatik konsept', 'Auto concept');
    case 'MATERIAL_BOARD':
      return pickLocalized(language, 'Malzeme paftası', 'Material board');
    case 'DEFENSE':
      return pickLocalized(language, 'Jüri savunması', 'Jury defense');
    case 'AI_MENTOR':
      return pickLocalized(language, 'AI Mentor', 'AI Mentor');
    case 'PREMIUM_RESCUE':
      return pickLocalized(language, 'Premium Rescue', 'Premium Rescue');
    default:
      return key.replace(/_/g, ' ');
  }
}
