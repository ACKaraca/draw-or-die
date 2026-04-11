'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowRight, ChevronDown, Sparkles, Layers, Cpu } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { HERO_MOCK_VISUALS } from '@/lib/hero-landing';
import type { StepType } from '@/types';

interface HeroStepProps {
  setStep: (step: StepType) => void;
}

export function HeroStep({ setStep }: HeroStepProps) {
  const language = useLanguage();

  const scrollToContent = () => {
    document.getElementById('landing-discover')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <motion.div
      key="hero"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-7xl flex flex-col items-center pb-24"
    >
      <div className="text-center max-w-3xl mb-10 mt-12 px-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-red/10 border border-neon-red/30 text-neon-red text-xs font-mono mb-8">
          <ShieldAlert size={14} />
          <span>
            {pickLocalized(language, 'YAPAY ZEKA DESTEKLİ MİMARİ JÜRİ', 'AI-POWERED ARCHITECTURE JURY')}
          </span>
        </div>
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-display font-bold tracking-tighter mb-6 uppercase leading-[1.05]">
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
        <p className="text-slate-400 text-lg md:text-xl mb-10 max-w-2xl mx-auto font-sans leading-relaxed">
          {pickLocalized(
            language,
            'Draw or Die; mimarlık öğrencileri için yapılandırılmış eleştiri, çoklu persona jüri, PDF desteği ve AI Mentor ile stüdyo masanı güçlendirir. Paftanı yükle, net geri bildirim al, savunmanı güçlendir.',
            'Draw or Die helps architecture students get structured critique—multi-persona jury, PDF-aware review, and an AI Mentor for your studio desk. Upload work, receive clear feedback, and sharpen your defense.',
          )}
        </p>
        <button
          type="button"
          onClick={() => setStep('upload')}
          className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-neon-red hover:bg-[#cc0029] transition-colors rounded-none overflow-hidden"
        >
          <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black" />
          <span className="relative flex items-center gap-2 font-mono uppercase tracking-wider">
            {pickLocalized(language, 'Studio Desk’e geç', 'Open Studio Desk')}{' '}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </span>
        </button>

        <div className="mt-14 flex flex-col items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.35em] text-slate-500">
            {pickLocalized(language, 'Keşfet', 'Discover')}
          </span>
          <button
            type="button"
            onClick={scrollToContent}
            className="rounded-full border border-white/15 bg-white/5 p-3 text-slate-300 hover:text-white hover:border-neon-red/50 transition-colors"
            aria-label={pickLocalized(language, 'Aşağı kaydır', 'Scroll down')}
          >
            <ChevronDown className="w-6 h-6 animate-bounce" />
          </button>
        </div>
      </div>

      <div id="landing-discover" className="w-full border-t border-white/10 pt-16 scroll-mt-28">
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: Layers,
              title: pickLocalized(language, 'Yapılandırılmış jüri', 'Structured jury'),
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
          ].map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/10 bg-black/30 p-6 text-left hover:border-neon-red/25 transition-colors"
            >
              <item.icon className="w-8 h-8 text-neon-red mb-4" strokeWidth={1.25} />
              <h3 className="font-display text-lg uppercase tracking-wide text-white mb-2">{item.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mb-10 text-center max-w-3xl mx-auto px-2">
          <h2 className="font-display text-2xl md:text-3xl uppercase tracking-wider text-white mb-4">
            {pickLocalized(language, 'Nasıl çalışır?', 'How it works')}
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            {pickLocalized(
              language,
              'Dosyanı Studio Desk’e bırak, proje bağlamını gir, sertlik seviyesini seç. Tek persona veya çoklu jüri ile analiz al; Premium özelliklerde savunma ve mentor ile derinleş. Sonuçları geçmişinde sakla, istersen toplulukla paylaş.',
              'Drop your file on the Studio Desk, add project context, and pick harshness. Get single or multi-persona analysis; go deeper with defense and mentor on Premium. Keep results in history—or share with the community.',
            )}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {HERO_MOCK_VISUALS.map((visual, idx) => (
            <figure
              key={visual.id}
              className="group rounded-xl border border-white/10 bg-black/40 overflow-hidden flex flex-col"
            >
              <div className="relative w-full aspect-[5/3]">
                <Image
                  src={visual.src}
                  alt={language === 'en' ? visual.altEn : visual.altTr}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover opacity-90 transition-opacity group-hover:opacity-100"
                  priority={idx === 0}
                />
              </div>
              <figcaption className="p-4 text-left flex flex-col gap-2 flex-1">
                <h3 className="font-display text-base uppercase tracking-wide text-white leading-snug">
                  {language === 'en' ? visual.titleEn : visual.titleTr}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {language === 'en' ? visual.captionEn : visual.captionTr}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-black/50 to-neon-red/5 p-8 md:p-10 text-center">
          <p className="text-slate-300 text-sm md:text-base max-w-2xl mx-auto mb-6 leading-relaxed">
            {pickLocalized(
              language,
              'Öğrenci stüdyosu için tasarlandı: hızlı iterasyon, net dil ve ölçülebilir ilerleme. Şimdi Studio Desk’e geç ve ilk analizini başlat.',
              'Built for student studios: fast iteration, clear language, and measurable progress. Open Studio Desk and run your first analysis.',
            )}
          </p>
          <button
            type="button"
            onClick={() => setStep('upload')}
            className="inline-flex items-center gap-2 px-6 py-3 font-mono text-xs uppercase tracking-widest border border-neon-red/60 text-neon-red hover:bg-neon-red/10 transition-colors"
          >
            {pickLocalized(language, 'Analize başla', 'Start analyzing')}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
