'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { LegalBrandHeader } from '@/components/LegalBrandHeader';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

export default function NotFound() {
  const language = useLanguage();

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-24 sm:px-6">
      <LegalBrandHeader />

      <p className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-neon-red/30 bg-neon-red/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-neon-red">
        <span aria-hidden="true">◆</span>
        {pickLocalized(language, '404 · Sayfa bulunamadı', '404 · Page not found')}
      </p>

      <h1 className="font-display text-[clamp(36px,6vw,64px)] font-bold uppercase leading-[1.02] tracking-tight text-white">
        {pickLocalized(language, 'Bu sayfa ', 'This page did not ')}
        <span className="neon-text">{pickLocalized(language, 'jüriden geçemedi', 'survive the jury')}</span>
      </h1>

      <p className="mt-6 max-w-[560px] text-base leading-relaxed text-slate-400">
        {pickLocalized(
          language,
          'Aradığın sayfa taşınmış, silinmiş ya da hiç var olmamış olabilir. Adresi kontrol et veya ana sayfadan devam et.',
          'The page you are looking for was moved, deleted, or never existed. Check the address or continue from the home page.',
        )}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-none bg-neon-red px-8 py-4 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#cc0029] cta-primary-glow"
        >
          {pickLocalized(language, 'Ana Sayfaya Dön', 'Back to Home')}
          <ArrowRight size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
        <Link
          href="/community"
          className="inline-flex items-center rounded-lg border border-white/15 px-6 py-4 font-mono text-[12px] uppercase tracking-[0.1em] text-slate-300 transition-colors hover:border-white/25 hover:text-white"
        >
          {pickLocalized(language, 'Topluluğa Göz At', 'Browse the Community')}
        </Link>
      </div>
    </div>
  );
}
