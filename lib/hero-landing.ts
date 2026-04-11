/**
 * Placeholder visuals for the marketing hero. Replace `src` with final assets when ready.
 *
 * Detailed image-generation prompts, negative prompts, and maintainer notes live in:
 * `docs/internal/hero-mock-visuals.md` (not shipped to users).
 */

export type HeroMockVisual = {
  id: string;
  /** Temporary placeholder — swap for production art */
  src: string;
  altTr: string;
  altEn: string;
};

export const HERO_MOCK_VISUALS: HeroMockVisual[] = [
  {
    id: 'studio-desk',
    src: 'https://placehold.co/1200x720/0a0f1a/ff0033/png?text=Studio+Desk',
    altTr: 'Studio Desk — pafta yükleme ve analiz akışı (yer tutucu)',
    altEn: 'Studio Desk — upload and analysis flow (placeholder)',
  },
  {
    id: 'jury-panel',
    src: 'https://placehold.co/1200x720/0f172a/38bdf8/png?text=AI+Jury',
    altTr: 'Çoklu jüri ve skor paneli (yer tutucu)',
    altEn: 'Multi-persona jury score panel (placeholder)',
  },
  {
    id: 'mentor',
    src: 'https://placehold.co/1200x720/1e1b4b/fbbf24/png?text=AI+Mentor',
    altTr: 'AI Mentor sohbet (yer tutucu)',
    altEn: 'AI Mentor chat (placeholder)',
  },
];
