import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

const ANALYSIS_KIND_LABELS: Record<string, { tr: string; en: string }> = {
  SINGLE_JURY: { tr: 'Tek Jüri', en: 'Single jury' },
  REVISION_SAME: { tr: 'Revizyon', en: 'Revision' },
  MULTI_JURY: { tr: 'Çoklu Jüri', en: 'Multi jury' },
  PREMIUM_RESCUE: { tr: 'Premium Rescue', en: 'Premium Rescue' },
  AUTO_CONCEPT: { tr: 'Konsept Üretimi', en: 'Concept generation' },
  MATERIAL_BOARD: { tr: 'Malzeme Paftası', en: 'Material board' },
  DRAWING_CONSISTENCY: { tr: 'Çizim Tutarlılığı', en: 'Drawing consistency' },
  CIRCULATION_ADJACENCY: { tr: 'Dolaşım ve Komşuluk', en: 'Circulation and adjacency' },
  ACCESSIBILITY_EGRESS: { tr: 'Erişilebilirlik ve Kaçış Ön Kontrolü', en: 'Accessibility and egress pre-check' },
  SKILL_ROADMAP: { tr: 'Kişisel Beceri Rotası', en: 'Personal skill roadmap' },
};

/** Labels for `analysisKind` in history and gallery cards. */
export function analysisKindLabel(kind: string, language: SupportedLanguage): string {
  const localized = ANALYSIS_KIND_LABELS[kind];
  if (!localized) {
    return kind.replace(/_/g, ' ');
  }
  return pickLocalized(language, localized.tr, localized.en);
}
