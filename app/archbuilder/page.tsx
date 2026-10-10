'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Compass, FileDown, LayoutGrid, Ruler } from 'lucide-react';

import { LegalBrandHeader } from '@/components/LegalBrandHeader';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';

// The interactive ArchBuilder step (components/ArchBuilderStep.tsx) has no /api/archbuilder backend yet,
// so this route stays a product preview page with a way back into the app instead of re-exporting the root page.
const PLANNING_STEPS = [
  { key: 'site', tr: 'Arsa', en: 'Site' },
  { key: 'constraints', tr: 'Kısıtlar', en: 'Constraints' },
  { key: 'envelope', tr: 'Kütle', en: 'Massing' },
  { key: 'program', tr: 'Program', en: 'Program' },
  { key: 'stacking', tr: 'Kat dağılımı', en: 'Floor stacking' },
  { key: 'adjacency', tr: 'Komşuluk', en: 'Adjacency' },
] as const;

const FEATURE_CARDS = [
  {
    icon: Compass,
    titleTr: 'Adım adım planlama',
    titleEn: 'Step-by-step planning',
    bodyTr:
      'Proje fikrini anlat; ArchBuilder arsa, kısıtlar ve programdan başlayarak planı aşama aşama kurar. '
      + 'Sen onaylamadan bir sonraki adıma geçilmez.',
    bodyEn:
      'Describe your project; ArchBuilder builds the plan stage by stage, starting from site, constraints and program. '
      + 'Nothing moves forward until you approve it.',
  },
  {
    icon: LayoutGrid,
    titleTr: 'Otomatik tutarlılık kontrolü',
    titleEn: 'Automatic consistency checks',
    bodyTr: 'Program alanlarının toplamı, tekrar eden mekânlar ve kat dağılımı her adımda kontrol edilir.',
    bodyEn: 'Program area totals, duplicate spaces and floor allocation are checked at every step.',
  },
  {
    icon: Ruler,
    titleTr: 'Mobilya yerleşimi',
    titleEn: 'Furniture layout',
    bodyTr: 'Temel mobilya yerleşimiyle mekânların gerçekten kullanılabilir olup olmadığını erken aşamada sına.',
    bodyEn: 'Test early whether your spaces actually work with a basic furniture layout.',
  },
  {
    icon: FileDown,
    titleTr: 'DXF ve PNG çıktı',
    titleEn: 'DXF and PNG export',
    bodyTr: 'Onaylanan planı CAD’de çalışmaya devam etmek için DXF, paylaşmak için PNG olarak al.',
    bodyEn: 'Take the approved plan to CAD as DXF, or share it as a PNG.',
  },
] as const;

export default function ArchBuilderPage() {
  const language = useLanguage();
  const setStep = useDrawOrDieStore((s) => s.setStep);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 pb-20 pt-8 sm:px-6">
      <LegalBrandHeader />

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-3xl"
      >
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-amber-200">
          <span aria-hidden="true">◆</span>
          {pickLocalized(language, 'ArchBuilder · Kapalı Önizleme', 'ArchBuilder · Closed Preview')}
        </p>
        <h1 className="font-display text-[clamp(36px,6vw,64px)] font-bold uppercase leading-[1.02] tracking-tight text-white">
          {pickLocalized(language, 'Fikirden ', 'From brief ')}
          <span className="text-amber-300">{pickLocalized(language, 'plan şemasına', 'to plan scheme')}</span>
        </h1>
        <p className="mt-6 max-w-[560px] text-base leading-relaxed text-slate-400">
          {pickLocalized(
            language,
            'ArchBuilder, proje fikrini onayladığın adımlarla bir plan şemasına dönüştürür: arsa ve kısıtlar, '
              + 'kütle, program, kat dağılımı ve komşuluk ilişkileri.',
            'ArchBuilder turns your project brief into a plan scheme through steps you approve: site and constraints, '
              + 'massing, program, floor stacking and adjacencies.',
          )}
        </p>
        <p className="mt-4 max-w-[560px] rounded-lg border border-amber-400/25 bg-amber-500/8 px-4 py-3 text-sm leading-relaxed text-amber-100">
          {pickLocalized(
            language,
            'ArchBuilder şu anda kapalı önizlemede. Açılana kadar paftanı Studio Desk’te jüriye sunabilirsin.',
            'ArchBuilder is in closed preview. Until it opens, put your board in front of the jury in Studio Desk.',
          )}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/"
            onClick={() => setStep('upload')}
            className="group inline-flex items-center justify-center gap-2 rounded-none bg-neon-red px-8 py-4 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#cc0029] cta-primary-glow"
          >
            {pickLocalized(language, 'Studio Desk’e Geç', 'Open Studio Desk')}
            <ArrowRight size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg border border-white/15 px-6 py-4 font-mono text-[12px] uppercase tracking-[0.1em] text-slate-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {pickLocalized(language, 'Ana Sayfa', 'Home')}
          </Link>
        </div>
      </motion.section>

      <section className="grid gap-4 sm:grid-cols-2" aria-label={pickLocalized(language, 'Özellikler', 'Features')}>
        {FEATURE_CARDS.map((card) => (
          <article
            key={card.titleEn}
            className="rounded-2xl border border-white/8 bg-[var(--color-bg-1)] p-7 transition-colors hover:border-neon-red/30"
          >
            <card.icon className="mb-4 h-6 w-6 text-amber-300" strokeWidth={1.25} aria-hidden="true" />
            <h2 className="font-display text-base uppercase tracking-[0.04em] text-white">
              {pickLocalized(language, card.titleTr, card.titleEn)}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {pickLocalized(language, card.bodyTr, card.bodyEn)}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-white/8 bg-[var(--color-bg-1)] p-7">
        <h2 className="section-divider">
          <span aria-hidden="true">◈</span>
          {pickLocalized(language, 'Altı planlama adımı', 'Six planning steps')}
        </h2>
        <ol className="flex flex-wrap gap-2">
          {PLANNING_STEPS.map((step, index) => (
            <li
              key={step.key}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-300"
            >
              <span className="text-amber-300">{String(index + 1).padStart(2, '0')}</span>
              {pickLocalized(language, step.tr, step.en)}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
