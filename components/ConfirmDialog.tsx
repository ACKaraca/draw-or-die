'use client';

import { useId, useRef, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { DialogFrame } from '@/components/DialogFrame';

type Props = {
  isOpen: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  busyLabel?: string;
  isBusy?: boolean;
  isConfirmDisabled?: boolean;
  /** Destructive dialogs focus the cancel button first so Enter never confirms by accident. */
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  isOpen,
  title,
  description,
  children,
  icon,
  confirmLabel,
  cancelLabel,
  busyLabel,
  isBusy = false,
  isConfirmDisabled = false,
  isDestructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  return (
    <DialogFrame
      isOpen={isOpen}
      onClose={() => {
        if (!isBusy) onCancel();
      }}
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
      initialFocusRef={isDestructive ? cancelRef : confirmRef}
    >
      <div className="flex items-start gap-3">
        {icon ? <span className="mt-0.5 shrink-0 text-text-muted">{icon}</span> : null}
        <h2 id={titleId} className="font-display text-lg font-bold uppercase tracking-[0.04em] text-white">
          {title}
        </h2>
      </div>

      {description ? (
        <div id={descriptionId} className="mt-3 font-sans text-sm leading-relaxed text-text-muted">
          {description}
        </div>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          disabled={isBusy}
          className="rounded-lg border border-white/[0.13] px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-text-muted transition-colors hover:border-white/[0.18] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          disabled={isBusy || isConfirmDisabled}
          aria-busy={isBusy}
          className="inline-flex items-center justify-center gap-2 rounded-none bg-neon-red px-6 py-3 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-white shadow-[0_0_24px_rgba(255,0,51,0.35)] transition-colors hover:bg-neon-red/90 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/25 disabled:shadow-none"
        >
          {isBusy ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" aria-hidden="true" /> : null}
          {isBusy && busyLabel ? busyLabel : confirmLabel}
        </button>
      </div>
    </DialogFrame>
  );
}
