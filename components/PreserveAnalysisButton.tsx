'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';

import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { ANALYSIS_PRESERVE_COST } from '@/hooks/useAnalysis';
import { pickLocalized } from '@/lib/i18n';

type Props = {
  onPreserve?: () => Promise<boolean | void> | void;
  className: string;
};

type PreserveStatus = 'idle' | 'saving' | 'done';

export function PreserveAnalysisButton({ onPreserve, className }: Props) {
  const language = useLanguage();
  const [status, setStatus] = useState<PreserveStatus>('idle');

  const handleClick = async () => {
    if (!onPreserve || status !== 'idle') return;
    setStatus('saving');
    try {
      const isPreserved = await onPreserve();
      setStatus(isPreserved === true ? 'done' : 'idle');
    } catch {
      setStatus('idle');
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={!onPreserve || status !== 'idle'}
      aria-busy={status === 'saving'}
      className={className}
    >
      {status === 'saving' ? (
        <>
          <Loader2 size={14} strokeWidth={1.5} className="animate-spin" aria-hidden="true" />
          {pickLocalized(language, 'Korunuyor…', 'Preserving…')}
        </>
      ) : status === 'done' ? (
        <>
          <Check size={14} strokeWidth={1.5} aria-hidden="true" />
          {pickLocalized(language, 'Analiz Korundu', 'Analysis preserved')}
        </>
      ) : (
        <>
          {pickLocalized(language, 'Analizi Koru', 'Preserve analysis')}{' '}
          <span className="font-mono text-[10px] font-normal opacity-60">({ANALYSIS_PRESERVE_COST} Rapido)</span>
        </>
      )}
    </button>
  );
}
