'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowRight, ChevronDown, Sparkles, Layers, Cpu } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { HERO_MOCK_VISUALS } from '@/lib/hero-landing';
import type { StepType } from '@/types';

interface HeroStepProps {
  setStep: (step: StepType) => void;
}

const HERO_FALLBACK_IMAGE_SRC = '/icon';

export function HeroStep({ setStep }: HeroStepProps) {
  const router = useRouter();
  const language = useLanguage();
  const [failedVisualIds, setFailedVisualIds] = useState<Record<string, boolean>>({});

  const scrollToContent = () => {
    document.getElementById('landing-discover')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const features = [
    {
      icon: Layers,
      title: pickLocalized(language, 'Yapılandırılmış jüri', 'Structured Jury'),
      body: pickLocalized(
        language,
        'Konsept, yapı ve sunum odağında tutarlı skor ve geri bildirim.',
        'Consistent scores and feedback across concept, structure, and presentation.',
      ),
    },
    {
      icon: Cpu,
      title: pickLocalized(language, 'Pafta + PDF', 'Board + PDF'),
      body: pickLocalized(
        language,
        'Görsel ve PDF paftalardan metin ve kompozisyonu birlikte okur.',
        'Reads composition and extracted text together from images and PDFs.',
      ),
    },
    {
      icon: Sparkles,
      title: pickLocalized(language, 'AI Mentor', 'AI Mentor'),
      body: pickLocalized(
        language,
        'Savunma stratejisi ve iterasyon için sohbet tabanlı rehberlik.',
        'Chat-based guidance for defense strategy and iteration.',
      ),
    },
  ];

  const steps = [
    {
      n: '01',
      title: pickLocalized(language, 'Dosyanı Bırak', 'Drop Your File'),
      body: pickLocalized(
        language,
        'A0/A1 paftanı, eskizini ya da render’ını yükle. PDF ve destek paftalarını tek akışta ekle.',
        'Upload your A0/A1 sheet, sketch, or render. Add PDFs and supporting sheets in one flow.',
      ),
    },
    {
      n: '02',
      title: pickLocalized(language, 'Sahneyi Kur', 'Set the Stage'),
      body: pickLocalized(
        language,
        'Proje bağlamını gir, jüri persona ve sertlik seviyesini seç.',
        'Enter project context, choose your jury persona and harshness level.',
      ),
    },
    {
      n: '03',
      title: pickLocalized(language, 'Jüriyle Yüzleş', 'Face the Jury'),
      body: pickLocalized(
        language,
        'Boyut başına skorlu yapılandırılmış eleştiri al. AI Mentor ile derinleş.',
        'Receive structured critique with scores per dimension. Go deeper with AI Mentor.',
      ),
    },
  ];

  return (
    <motion.div
      key="hero"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-7xl flex flex-col items-center pb-24"
    >
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="text-center max-w-3xl mt-12 sm:mt-16 mb-10 px-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-red/10 border border-neon-red/30 text-neon-red text-[11px] font-mono uppercase tracking-[0.12em] mb-7">
          <ShieldAlert size={13} strokeWidth={1.75} />
          <span>
            {pickLocalized(language, 'Yapay Zeka Destekli Mimari Jüri', 'AI-Powered Architecture Jury')}
          </span>
        </div>

        <h1 className="font-display font-bold text-white uppercase tracking-tight leading-[1.02] text-[clamp(48px,8vw,96px)] mb-6">
          {language === 'en' ? (
            <>
              Upload your board, <br />
              <span className="neon-text">face the jury</span>
            </>
          ) : (
            <>
              Paftanı yükle, <br />
              <span className="neon-text">jüriyle yüzleş</span>
            </>
          )}
        </h1>

        <p className="text-slate-400 text-base md:text-lg mb-9 max-w-xl mx-auto font-sans leading-relaxed">
          {pickLocalized(
            language,
            'Draw or Die; mimarlık öğrencileri için yapılandırılmış eleştiri, çoklu persona jüri, PDF desteği ve AI Mentor ile stüdyo masanı güçlendirir.',
            'Draw or Die helps architecture students get structured critique — multi-persona jury, PDF-aware review, and an AI Mentor for your studio desk.',
          )}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setStep('upload')}
            className="group inline-flex items-center justify-center gap-2 px-8 py-4 font-mono font-bold text-[13px] uppercase tracking-[0.12em] text-white bg-neon-red hover:bg-[#cc0029] transition-colors rounded-none cta-primary-glow"
          >
            {pickLocalized(language, 'Studio Desk’e Geç', 'Open Studio Desk')}
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => router.push('/archbuilder')}
            className="inline-flex items-center justify-center gap-2 border border-amber-400/40 bg-amber-500/12 px-7 py-4 font-mono text-[12px] uppercase tracking-[0.1em] text-amber-200 hover:bg-amber-500/20 transition-colors rounded-lg"
          >
            {pickLocalized(language, 'ArchBuilder Dene', 'Try ArchBuilder')}
          </button>
        </div>

        {/* Discover ↓ */}
        <div className="mt-14 flex flex-col items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
            {pickLocalized(language, 'Keşfet', 'Discover')}
          </span>
          <button
            type="button"
            onClick={scrollToContent}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label={pickLocalized(language, 'Aşağı kaydır', 'Scroll down')}
          >
            <ChevronDown className="w-5 h-5 pulse-soft" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* ── Feature cards ──────────────────────────────────────────────── */}
      <div id="landing-discover" className="w-full px-2 pt-16 scroll-mt-28">
        <div className="grid md:grid-cols-3 gap-5 mb-20">
          {features.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/8 bg-[var(--color-bg-1)] p-7 text-left transition-colors hover:border-neon-red/30"
            >
              <item.icon
                className="w-7 h-7 text-neon-red mb-4"
                strokeWidth={1.25}
                style={{ filter: 'drop-shadow(0 0 8px rgba(255,0,51,0.35))' }}
              />
              <h3 className="font-display text-base uppercase tracking-[0.04em] text-white mb-2.5">
                {item.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        {/* ── How it works ────────────────────────────────────────────── */}
        <div className="text-center max-w-3xl mx-auto px-2 mb-12">
          <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-[0.04em] text-white mb-4">
            {pickLocalized(language, 'Nasıl Çalışır?', 'How It Works')}
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            {pickLocalized(
              language,
              'Dosyadan yapılandırılmış eleştiriye üç adım. Kurulum gerekmez.',
              'Three steps from file to structured critique. No setup required.',
            )}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-20">
          {steps.map((s) => (
            <div
              key={s.n}
              className="relative overflow-hidden rounded-2xl border border-white/8 bg-[var(--color-bg-1)] p-7"
            >
              <div className="absolute top-5 right-5 font-mono font-bold text-[48px] leading-none text-white/[0.04] select-none">
                {s.n}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-neon-red mb-3">
                {pickLocalized(language, `ADIM ${s.n}`, `STEP ${s.n}`)}
              </div>
              <h3 className="font-display text-lg uppercase tracking-[0.02em] text-white mb-2.5">
                {s.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>

        {/* ── Visual showcase (mock board previews) ───────────────────── */}
        <div className="grid md:grid-cols-3 gap-5 mb-20">
          {HERO_MOCK_VISUALS.map((visual, idx) => (
            <figure
              key={visual.id}
              className="group rounded-xl border border-white/8 bg-black/40 overflow-hidden flex flex-col"
            >
              <div className="relative w-full aspect-[5/3]">
                <Image
                  src={failedVisualIds[visual.id] ? HERO_FALLBACK_IMAGE_SRC : visual.src}
                  alt={language === 'en' ? visual.altEn : visual.altTr}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
                  unoptimized
                  priority={idx === 0}
                  onError={() => {
                    setFailedVisualIds((prev) => (prev[visual.id] ? prev : { ...prev, [visual.id]: true }));
                  }}
                />
              </div>
              <figcaption className="p-5 text-left flex flex-col gap-2 flex-1">
                <h3 className="font-display text-base uppercase tracking-[0.02em] text-white leading-snug">
                  {language === 'en' ? visual.titleEn : visual.titleTr}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {language === 'en' ? visual.captionEn : visual.captionTr}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>

        {/* ── Bottom CTA panel ────────────────────────────────────────── */}
        <div
          className="rounded-2xl border border-white/8 p-10 md:p-12 text-center max-w-3xl mx-auto"
          style={{
            background: 'linear-gradient(135deg, rgba(10,15,26,0.8) 0%, rgba(255,0,51,0.04) 100%)',
          }}
        >
          <p className="text-slate-300 text-sm md:text-base max-w-xl mx-auto mb-7 leading-relaxed">
            {pickLocalized(
              language,
              'Öğrenci stüdyosu için tasarlandı: hızlı iterasyon, net dil ve ölçülebilir ilerleme.',
              'Built for student studios: fast iteration, clear language, and measurable progress.',
            )}
          </p>
          <button
            type="button"
            onClick={() => setStep('upload')}
            className="group inline-flex items-center gap-2 px-8 py-4 font-mono font-bold text-[13px] uppercase tracking-[0.12em] text-white bg-neon-red hover:bg-[#cc0029] transition-colors rounded-none cta-primary-glow"
          >
            {pickLocalized(language, 'Analize Başla', 'Start Analyzing')}
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" strokeWidth={2} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
