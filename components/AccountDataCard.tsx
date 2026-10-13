'use client';

import { useId, useState } from 'react';
import { Download, Loader2, Trash2 } from 'lucide-react';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { useAuth } from '@/hooks/useAuth';
import { pickLocalized } from '@/lib/i18n';
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/privacy/constants';
import { BACKUP_RETENTION_DAYS, BILLING_RECORD_RETENTION_YEARS } from '@/lib/privacy/retention';

type DeletionStatus = 'requested' | 'in_progress' | 'partial' | 'blocked' | 'completed';

type DeletionResponse = {
  request?: { status: DeletionStatus } | null;
  error?: string;
};

type Notice = { kind: 'success' | 'error' | 'info'; text: string };

export function AccountDataCard() {
  const language = useLanguage();
  const { profile, getJWT, signOut } = useAuth();
  const confirmInputId = useId();
  const [isExporting, setIsExporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);

  const confirmWord = pickLocalized(language, 'SİL', 'DELETE');
  const isConfirmationTyped = typedConfirmation.trim().toLocaleUpperCase(language === 'tr' ? 'tr-TR' : 'en-US')
    === confirmWord;
  const hasSubscription = Boolean(profile?.is_premium);

  const handleExport = async () => {
    setIsExporting(true);
    setNotice(null);
    try {
      const jwt = await getJWT();
      const response = await fetch('/api/account/export', { headers: { Authorization: `Bearer ${jwt}` } });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || pickLocalized(language, 'Dışa aktarım başarısız.', 'Export failed.'));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `drawordie-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice({ kind: 'success', text: pickLocalized(language, 'Verilerin indirildi.', 'Your data was downloaded.') });
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error && error.message
          ? error.message
          : pickLocalized(language, 'Dışa aktarım başarısız.', 'Export failed.'),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setTypedConfirmation('');
  };

  const handleDelete = async () => {
    if (!isConfirmationTyped) return;
    setIsDeleting(true);
    setNotice(null);
    try {
      const jwt = await getJWT();
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: ACCOUNT_DELETION_CONFIRMATION }),
      });
      const payload = (await response.json().catch(() => ({}))) as DeletionResponse;
      if (!response.ok && response.status !== 202) {
        throw new Error(payload.error || pickLocalized(language, 'Silme talebi işlenemedi.', 'Deletion request failed.'));
      }

      const status = payload.request?.status;
      closeDialog();
      if (status === 'completed') {
        setNotice({ kind: 'success', text: pickLocalized(language, 'Hesabın ve verilerin silindi.', 'Your account and data were deleted.') });
        await signOut().catch(() => undefined);
        return;
      }
      if (status === 'blocked') {
        setNotice({
          kind: 'info',
          text: pickLocalized(
            language,
            'Verilerin silindi. Stripe ödeme kaydının kapatılması işletmeci onayı bekliyor; tamamlandığında talep kapanır.',
            'Your data was deleted. Closing your Stripe billing record is waiting for the operator; the request closes once that is done.',
          ),
        });
        await signOut().catch(() => undefined);
        return;
      }
      setNotice({
        kind: 'error',
        text: pickLocalized(
          language,
          'Silme işleminin bir kısmı tamamlanamadı. Talebin kaydedildi; birkaç dakika sonra tekrar dene, kaldığı yerden devam eder.',
          'Part of the deletion could not finish. Your request is recorded; try again in a few minutes and it resumes where it stopped.',
        ),
      });
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error && error.message
          ? error.message
          : pickLocalized(language, 'Silme talebi işlenemedi.', 'Deletion request failed.'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const noticeClass = notice?.kind === 'error'
    ? 'border-[rgba(255,107,107,0.25)] bg-[rgba(255,107,107,0.08)] text-[#FCA5A5]'
    : notice?.kind === 'success'
      ? 'border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.08)] text-emerald-200'
      : 'border-[rgba(34,211,238,0.2)] bg-[rgba(34,211,238,0.06)] text-cyan-100';

  return (
    <section
      aria-labelledby="account-data-heading"
      className="mt-6 rounded-xl border border-white/[0.08] bg-[#101A2F] p-5"
    >
      <h3
        id="account-data-heading"
        className="flex items-center gap-2 border-b border-white/[0.08] pb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted"
      >
        <span aria-hidden="true">◈</span> {pickLocalized(language, 'Verilerim', 'My data')}
      </h3>
      <p className="mt-4 text-sm leading-relaxed text-text-muted">
        {pickLocalized(
          language,
          'Hesabındaki tüm verileri JSON olarak indirebilir ya da hesabının ve verilerinin kalıcı olarak silinmesini isteyebilirsin. Ayrıntılar Gizlilik Politikası’nda.',
          'Download all of your account data as JSON, or request permanent deletion of your account and data. Details are in the Privacy Policy.',
        )}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting}
          aria-busy={isExporting}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.13] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-white transition-colors hover:border-white/[0.18] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting
            ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" aria-hidden="true" />
            : <Download size={14} strokeWidth={1.5} aria-hidden="true" />}
          {pickLocalized(language, 'Verilerimi İndir', 'Download my data')}
        </button>
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[rgba(255,0,51,0.4)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-neon-red transition-colors hover:bg-[rgba(255,0,51,0.12)]"
        >
          <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
          {pickLocalized(language, 'Hesabımı Sil', 'Delete my account')}
        </button>
      </div>

      {notice ? (
        <p role="status" className={`mt-4 rounded-lg border px-3 py-2 text-sm ${noticeClass}`}>
          {notice.text}
        </p>
      ) : null}

      <ConfirmDialog
        isOpen={isDialogOpen}
        isDestructive
        title={pickLocalized(language, 'Hesabı kalıcı olarak sil', 'Permanently delete account')}
        description={
          <>
            <p>
              {pickLocalized(
                language,
                'Profilin, Rapido bakiyen, analiz geçmişin, yüklediğin dosyalar, galeri paylaşımların, AI Mentor sohbetlerin ve AI hafıza notların silinir. Bu işlem geri alınamaz.',
                'Your profile, Rapido balance, analysis history, uploaded files, gallery posts, AI Mentor chats and AI memory notes are deleted. This cannot be undone.',
              )}
            </p>
            <p className="mt-2">
              {pickLocalized(
                language,
                `Ödeme kayıtları yasal zorunluluk nedeniyle en fazla ${BILLING_RECORD_RETENTION_YEARS} yıl saklanır. Yedeklerden silinmesi ${BACKUP_RETENTION_DAYS} güne kadar sürebilir.`,
                `Billing records are kept for up to ${BILLING_RECORD_RETENTION_YEARS} years by law. Removal from backups can take up to ${BACKUP_RETENTION_DAYS} days.`,
              )}
            </p>
            {hasSubscription ? (
              <p className="mt-2 text-amber-200">
                {pickLocalized(
                  language,
                  'Aktif aboneliğin varsa önce abonelik yönetiminden iptal et; aksi halde iptal işletmeci tarafından elle yapılana kadar talep beklemede kalır.',
                  'If you have an active subscription, cancel it first from subscription management; otherwise the request stays pending until the operator cancels it manually.',
                )}
              </p>
            ) : null}
          </>
        }
        confirmLabel={pickLocalized(language, 'Hesabımı Sil', 'Delete my account')}
        cancelLabel={pickLocalized(language, 'Vazgeç', 'Cancel')}
        busyLabel={pickLocalized(language, 'Siliniyor...', 'Deleting...')}
        isBusy={isDeleting}
        isConfirmDisabled={!isConfirmationTyped}
        onConfirm={() => void handleDelete()}
        onCancel={closeDialog}
      >
        <label htmlFor={confirmInputId} className="mb-1.5 block font-sans text-[13px] font-semibold text-white">
          {pickLocalized(language, `Onaylamak için ${confirmWord} yaz`, `Type ${confirmWord} to confirm`)}
        </label>
        <input
          id={confirmInputId}
          type="text"
          autoComplete="off"
          value={typedConfirmation}
          onChange={(event) => setTypedConfirmation(event.target.value)}
          disabled={isDeleting}
          className="w-full rounded-lg border border-white/[0.08] bg-black/40 px-3.5 py-2.5 font-sans text-sm text-white placeholder:text-text-dim focus:border-[rgba(255,0,51,0.6)] focus:outline-none"
          placeholder={confirmWord}
        />
      </ConfirmDialog>
    </section>
  );
}
