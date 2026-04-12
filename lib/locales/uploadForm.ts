import type { JuryPersonaId } from '@/types';
import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

/** Stored category values remain Turkish for backwards compatibility with existing analyses and AI auto-fill. */
export const STUDIO_CATEGORY_VALUES = [
  'Vaziyet Planı',
  'Kentsel Tasarım',
  'Kamusal Yapı',
  'Eğitim Yapısı',
  'Sağlık Yapısı',
  'Konut',
  'Karma Kullanım',
  'Pafta Tasarımı',
  'Render',
  'Strüktürel Kesit',
  'Konsept Diyagram',
  'Peyzaj ve Açık Alan',
  'Restorasyon / Yeniden İşlevlendirme',
  'İç Mekan Kurgusu',
] as const;

const CATEGORY_EN: Record<(typeof STUDIO_CATEGORY_VALUES)[number], string> = {
  'Vaziyet Planı': 'Site plan',
  'Kentsel Tasarım': 'Urban design',
  'Kamusal Yapı': 'Public building',
  'Eğitim Yapısı': 'Educational building',
  'Sağlık Yapısı': 'Healthcare building',
  Konut: 'Housing',
  'Karma Kullanım': 'Mixed use',
  'Pafta Tasarımı': 'Sheet design',
  Render: 'Render',
  'Strüktürel Kesit': 'Structural section',
  'Konsept Diyagram': 'Concept diagram',
  'Peyzaj ve Açık Alan': 'Landscape and open space',
  'Restorasyon / Yeniden İşlevlendirme': 'Restoration / adaptive reuse',
  'İç Mekan Kurgusu': 'Interior spatial design',
};

export function studioCategoryLabel(lang: SupportedLanguage, value: string): string {
  if (!STUDIO_CATEGORY_VALUES.includes(value as (typeof STUDIO_CATEGORY_VALUES)[number])) {
    return value;
  }
  const key = value as (typeof STUDIO_CATEGORY_VALUES)[number];
  return pickLocalized(lang, key, CATEGORY_EN[key]);
}

export const STUDIO_PERSONA_I18N: Array<{
  id: JuryPersonaId;
  label: { tr: string; en: string };
  detail: { tr: string; en: string };
}> = [
  {
    id: 'constructive',
    label: { tr: 'Yapıcı Mentor', en: 'Constructive mentor' },
    detail: {
      tr: 'Dengeyi korur, net iyileştirme adımları verir.',
      en: 'Keeps balance and gives clear improvement steps.',
    },
  },
  {
    id: 'structural',
    label: { tr: 'Strüktürcü', en: 'Structural critic' },
    detail: {
      tr: 'Taşıyıcı sistem, uygulanabilirlik ve teknik tutarlılığa odaklanır.',
      en: 'Focuses on structure, buildability, and technical consistency.',
    },
  },
  {
    id: 'conceptual',
    label: { tr: 'Konseptüel', en: 'Conceptual' },
    detail: {
      tr: 'Mekânsal fikir, anlatı ve kavramsal bağlantıları sorgular.',
      en: 'Questions spatial ideas, narrative, and conceptual links.',
    },
  },
  {
    id: 'grumpy',
    label: { tr: 'Huysuz Jüri', en: 'Grumpy juror' },
    detail: {
      tr: 'Sert, doğrudan ve acımasız teknik geri bildirim verir.',
      en: 'Delivers blunt, direct, ruthless technical feedback.',
    },
  },
  {
    id: 'contextualist',
    label: { tr: 'Bağlamcı', en: 'Contextualist' },
    detail: {
      tr: 'Yer, iklim, kamusal akış ve çevre ilişkilerini öne çıkarır.',
      en: 'Emphasizes place, climate, public flow, and environmental relations.',
    },
  },
  {
    id: 'sustainability',
    label: { tr: 'Sürdürülebilirlik Uzmanı', en: 'Sustainability specialist' },
    detail: {
      tr: 'Enerji, malzeme ömrü ve karbon etkisini değerlendirir.',
      en: 'Evaluates energy, material lifespan, and carbon impact.',
    },
  },
];

export function studioTutorialSteps(lang: SupportedLanguage): Array<{ title: string; text: string }> {
  return [
    {
      title: pickLocalized(lang, 'Studio Desk Hoş Geldin', 'Welcome to Studio Desk'),
      text: pickLocalized(
        lang,
        'Ana dosyanı ve ek paftalarını aynı anda yükleyebilirsin. Sol panelde dosyalar arasında geçiş yaparak tek tek inceleme yap.',
        'Upload your main file and extra sheets at once. Switch between files in the left panel to review each one.',
      ),
    },
    {
      title: pickLocalized(lang, 'Otomatik Doldur', 'Auto-fill'),
      text: pickLocalized(
        lang,
        'Konu, arazi, konsept ve savunma alanlarını AI ile doldurabilirsin. Her alanın yanında otomatik anahtarını açıp kapat.',
        'You can fill topic, site, concept, and defense fields with AI. Toggle auto-fill per field.',
      ),
    },
    {
      title: pickLocalized(lang, 'Analiz Derinliği', 'Analysis depth'),
      text: pickLocalized(
        lang,
        'Üyelik seviyene göre analiz uzunluğu değişir. Misafir kısa, kayıtlı kısa/orta, premium kısa/orta/uzun seçeneklerine sahiptir.',
        'Analysis length depends on your tier: guest short; registered short/medium; premium short/medium/long.',
      ),
    },
  ];
}
