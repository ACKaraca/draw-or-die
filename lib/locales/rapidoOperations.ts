import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

const RAPIDO_OPERATION_LABELS: Record<string, { tr: string; en: string }> = {
  SINGLE_JURY: { tr: 'Tekli jüri', en: 'Single jury' },
  REVISION_SAME: { tr: 'Revizyon (aynı proje)', en: 'Revision (same project)' },
  REVISION_DIFFERENT: { tr: 'Revizyon (farklı proje)', en: 'Revision (different project)' },
  MULTI_JURY: { tr: 'Çoklu jüri', en: 'Multi jury' },
  MULTI_JURY_REVISION: { tr: 'Çoklu jüri revizyonu', en: 'Multi-jury revision' },
  AUTO_CONCEPT: { tr: 'Otomatik konsept', en: 'Auto concept' },
  MATERIAL_BOARD: { tr: 'Malzeme paftası', en: 'Material board' },
  DEFENSE: { tr: 'Jüri savunması', en: 'Jury defense' },
  AI_MENTOR: { tr: 'AI Mentor', en: 'AI Mentor' },
  PREMIUM_RESCUE: { tr: 'Premium Rescue', en: 'Premium Rescue' },
  DRAWING_CONSISTENCY: { tr: 'Çizim tutarlılığı', en: 'Drawing consistency' },
  CIRCULATION_ADJACENCY: { tr: 'Dolaşım ve komşuluk', en: 'Circulation and adjacency' },
  ACCESSIBILITY_EGRESS: { tr: 'Erişilebilirlik ve kaçış', en: 'Accessibility and egress' },
  SKILL_ROADMAP: { tr: 'Kişisel beceri rotası', en: 'Personal skill roadmap' },
};

/** User-facing label for a Rapido cost key (see `lib/pricing.ts` → RAPIDO_COSTS). */
export function rapidoCostOperationLabel(key: string, language: SupportedLanguage): string {
  const localized = RAPIDO_OPERATION_LABELS[key];
  if (!localized) {
    return key.replace(/_/g, ' ');
  }
  return pickLocalized(language, localized.tr, localized.en);
}
