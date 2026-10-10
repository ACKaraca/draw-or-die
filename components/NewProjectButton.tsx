'use client';

import { useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

type Props = {
  onConfirm: () => void;
  className: string;
  children: ReactNode;
};

export function NewProjectButton({ onConfirm, className, children }: Props) {
  const language = useLanguage();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setIsConfirmOpen(true)} className={className}>
        {children}
      </button>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        isDestructive
        title={pickLocalized(language, 'Yeni projeye geçilsin mi?', 'Start a new project?')}
        description={pickLocalized(
          language,
          'Bu sonuç ekrandan kaldırılacak. Korumadığın analizler geri getirilemez; saklamak için önce "Analizi Koru"yu kullan.',
          'This result will be cleared from the screen. Analyses you have not preserved cannot be recovered; use "Preserve analysis" first to keep it.',
        )}
        icon={<AlertTriangle size={18} strokeWidth={1.5} />}
        confirmLabel={pickLocalized(language, 'Yeni Proje Başlat', 'Start new project')}
        cancelLabel={pickLocalized(language, 'Vazgeç', 'Cancel')}
        onConfirm={() => {
          setIsConfirmOpen(false);
          onConfirm();
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </>
  );
}
