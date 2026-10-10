'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';

import { LegalBrandHeader } from '@/components/LegalBrandHeader';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { reportClientError } from '@/lib/logger';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RouteError({ error, reset }: Props) {
  const language = useLanguage();

  useEffect(() => {
    void reportClientError({
      scope: 'app.error-boundary',
      message: error.message || 'Unhandled render error',
      details: { digest: error.digest ?? null, stack: error.stack ?? null },
    });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col justify-center px-4 py-24 sm:px-6">
      <LegalBrandHeader />

      <div role="alert" className="rounded-2xl border border-white/8 bg-[var(--color-bg-1)] p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-red-300">
          {pickLocalized(language, 'Beklenmeyen hata', 'Unexpected error')}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-[0.04em] text-white sm:text-4xl">
          {pickLocalized(language, 'Bir şeyler ters gitti', 'Something went wrong')}
        </h1>
        <p className="mt-4 max-w-[560px] text-base leading-relaxed text-slate-400">
          {pickLocalized(
            language,
            'Bu ekran yüklenirken bir sorun oluştu. Tekrar deneyebilir ya da ana sayfaya dönebilirsin; sorun sürerse sayfanın altındaki Geri Bildirim formundan bize yaz.',
            'Something broke while loading this screen. Try again or go back home; if it keeps happening, tell us via the Feedback form at the bottom of the page.',
          )}
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-none bg-neon-red px-8 py-4 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#cc0029] cta-primary-glow"
          >
            <RotateCcw size={16} strokeWidth={2} aria-hidden="true" />
            {pickLocalized(language, 'Tekrar Dene', 'Try Again')}
          </button>
          <Link
            href="/"
            className="inline-flex items-center rounded-lg border border-white/15 px-6 py-4 font-mono text-[12px] uppercase tracking-[0.1em] text-slate-300 transition-colors hover:border-white/25 hover:text-white"
          >
            {pickLocalized(language, 'Ana Sayfa', 'Home')}
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
            {pickLocalized(language, 'Hata kodu', 'Error reference')}: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
