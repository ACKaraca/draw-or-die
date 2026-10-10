'use client';

import { useState } from 'react';
import { Check, Loader2, Users } from 'lucide-react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

export type CommunityShareOptions = { confirmed: boolean };

type Props = {
  onShare?: (options: CommunityShareOptions) => Promise<boolean | void> | void;
  className: string;
};

type ShareStatus = 'idle' | 'confirming' | 'sharing' | 'done';

export function CommunityShareButton({ onShare, className }: Props) {
  const language = useLanguage();
  const [status, setStatus] = useState<ShareStatus>('idle');

  const handleConfirm = async () => {
    if (!onShare || status !== 'confirming') return;
    setStatus('sharing');
    try {
      const isShared = await onShare({ confirmed: true });
      setStatus(isShared === true ? 'done' : 'idle');
    } catch {
      setStatus('idle');
    }
  };

  const consentItems = [
    pickLocalized(
      language,
      'Yüklediğim pafta/görsel için paylaşım hakkına sahibim.',
      'I have the right to share the board/image I uploaded.',
    ),
    pickLocalized(
      language,
      'Kişisel veri (telefon, e-posta, öğrenci no, imza vb.) içeren alanları kontrol ettim.',
      'I checked for personal data (phone, email, student ID, signature, etc.).',
    ),
    pickLocalized(
      language,
      'Topluluk kurallarını okudum, anladım ve paylaşım sorumluluğunu kabul ediyorum.',
      'I read and accept the community rules and responsibility for sharing.',
    ),
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setStatus('confirming')}
        disabled={!onShare || status !== 'idle'}
        aria-busy={status === 'sharing'}
        className={className}
      >
        {status === 'sharing' ? (
          <>
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" aria-hidden="true" />
            {pickLocalized(language, 'Paylaşılıyor…', 'Sharing…')}
          </>
        ) : status === 'done' ? (
          <>
            <Check size={14} strokeWidth={1.5} aria-hidden="true" />
            {pickLocalized(language, 'Toplulukta Paylaşıldı', 'Shared with community')}
          </>
        ) : (
          pickLocalized(language, 'Toplulukta Paylaş', 'Share with community')
        )}
      </button>

      <ConfirmDialog
        isOpen={status === 'confirming' || status === 'sharing'}
        title={pickLocalized(language, 'Toplulukta paylaşılsın mı?', 'Share with the community?')}
        description={pickLocalized(
          language,
          'Paftan ve jüri yorumunun bir bölümü herkese açık Community galerisinde görünecek. Devam etmeden önce şunları onayla:',
          'Your board and an excerpt of the jury comment will appear in the public Community gallery. Confirm the following before you continue:',
        )}
        icon={<Users size={18} strokeWidth={1.5} />}
        confirmLabel={pickLocalized(language, 'Onaylıyorum, Paylaş', 'I confirm, share')}
        busyLabel={pickLocalized(language, 'Paylaşılıyor…', 'Sharing…')}
        cancelLabel={pickLocalized(language, 'Vazgeç', 'Cancel')}
        isBusy={status === 'sharing'}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setStatus('idle')}
      >
        <ol className="list-decimal space-y-2 pl-5 font-sans text-[13px] leading-relaxed text-text">
          {consentItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </ConfirmDialog>
    </>
  );
}
