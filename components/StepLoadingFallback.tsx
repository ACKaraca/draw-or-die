'use client';

import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

export function StepLoadingFallback() {
  const language = useLanguage();

  return (
    <div role="status" aria-live="polite" className="flex min-h-[240px] w-full flex-col items-center justify-center gap-3">
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-cyan [animation-duration:0.8s]"
      />
      <span className="font-mono text-xs uppercase tracking-[0.1em] text-text-muted">
        {pickLocalized(language, 'Yükleniyor…', 'Loading…')}
      </span>
    </div>
  );
}
