/**
 * Hero section visuals (`public/1.png` … `public/3.png`) and localized captions.
 * Image-generation playbooks: `docs/internal/hero-mock-visuals.md`.
 */

export type HeroMockVisual = {
  id: string;
  src: string;
  altTr: string;
  altEn: string;
  titleTr: string;
  titleEn: string;
  captionTr: string;
  captionEn: string;
};

export const HERO_MOCK_VISUALS: HeroMockVisual[] = [
  {
    id: '1',
    src: '/1.png',
    altTr: 'Gece ışığında mimarlık çalışma masası, pafta ve çizim düzeni',
    altEn: 'Architecture studio desk at night with drawings and plans',
    titleTr: 'Studio Desk’ten analize',
    titleEn: 'From desk to analysis',
    captionTr:
      'Çizimini, PDF’ini ve ek paftalarını tek akışta yükle; proje bağlamını ve jüri sertliğini seçip paftanı tek tıkla jüriye gönder.',
    captionEn:
      'Upload drawings, PDFs, and supporting sheets in one flow—set project context and jury harshness, then send your board in one click.',
  },
  {
    id: '2',
    src: '/2.png',
    altTr: 'Fütüristik holografik yapay zeka jüri paneli ve çoklu persona görünümü',
    altEn: 'Futuristic holographic AI jury panel with multiple persona view',
    titleTr: 'Çoklu persona, tek pafta',
    titleEn: 'Multiple personas, one board',
    captionTr:
      'Konsept, yapı ve bağlamı birlikte okuyan jüri; çoklu jüri ile aynı paftaya farklı eleştirmen bakışları (Premium).',
    captionEn:
      'Jury modes that read concept, structure, and context together—multi-persona critique from different viewpoints (Premium).',
  },
  {
    id: '3',
    src: '/3.png',
    altTr: 'Gece stüdyosunda çalışan mimarlık öğrencisi ve yapay zeka destekli çalışma',
    altEn: 'Architecture student working late in studio with AI-assisted workflow',
    titleTr: 'AI Mentor ile derinleş',
    titleEn: 'Go deeper with AI Mentor',
    captionTr:
      'Savunmanı ve iterasyonunu netleştiren sohbet; Premium’da jüri savunması ve mentor ile stüdyo akşamlarına eşlik eder.',
    captionEn:
      'Chat-based guidance to sharpen defense and iteration—Premium adds jury defense and the AI Mentor for long studio nights.',
  },
];
