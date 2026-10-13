'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCcw, X } from 'lucide-react';

import NotFound from '@/app/not-found';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

type QueueKind = 'gallery' | 'confession';

type QueueItem = {
  id: string;
  kind: QueueKind;
  title: string;
  text: string;
  type: string;
  createdAt: string;
  imageUrl: string | null;
};

type QueueResponse = {
  items?: Array<{ id: string; title: string; jury: string; type: string; createdAt: string; imageUrl: string | null }>;
  confessions?: Array<{ id: string; text: string; createdAt: string; imageUrl: string | null }>;
};

const API_PATH = '/api/gallery/moderation';

function toQueueItems(payload: QueueResponse): QueueItem[] {
  const gallery = (payload.items ?? []).map((item) => ({
    id: item.id,
    kind: 'gallery' as const,
    title: item.title,
    text: item.jury,
    type: item.type,
    createdAt: item.createdAt,
    imageUrl: item.imageUrl,
  }));
  const confessions = (payload.confessions ?? []).map((item) => ({
    id: item.id,
    kind: 'confession' as const,
    title: '',
    text: item.text,
    type: 'CONFESSION',
    createdAt: item.createdAt,
    imageUrl: item.imageUrl,
  }));
  return [...gallery, ...confessions];
}

/** Hidden moderator queue. Anything short of a 200 from the API renders the regular 404 page. */
export function ModerationQueue() {
  const language = useLanguage();
  const { user, loading: isAuthLoading, getJWT } = useAuth();
  // null until the API answers 200; also null for non-moderators, who must only ever see the 404 page.
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [activeKind, setActiveKind] = useState<QueueKind>('gallery');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const loadQueue = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch(API_PATH, { headers: { Authorization: `Bearer ${await getJWT()}` } });
      if (response.status !== 200) {
        setItems(null);
        return;
      }
      setItems(toQueueItems((await response.json()) as QueueResponse));
    } catch {
      // Network/JWT failure: keep whatever is already shown (null stays the 404 page).
    } finally {
      setIsRefreshing(false);
    }
  }, [getJWT]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      setItems(null);
      return;
    }
    void loadQueue();
  }, [isAuthLoading, user, loadQueue]);

  const decide = async (item: QueueItem, action: 'APPROVE' | 'REJECT') => {
    const note = (notes[item.id] ?? '').trim();
    setErrorMessage('');
    setItems((prev) => prev && prev.filter((entry) => entry.id !== item.id));

    try {
      const response = await fetch(API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getJWT()}` },
        body: JSON.stringify({
          submissionId: item.id,
          kind: item.kind,
          action,
          ...(action === 'REJECT' && note ? { note } : {}),
        }),
      });
      if (!response.ok) throw new Error(`Moderation failed with ${response.status}`);
      setStatusMessage(action === 'APPROVE'
        ? pickLocalized(language, 'Onaylandı ve yayınlandı.', 'Approved and published.')
        : pickLocalized(language, 'Reddedildi, görsel silindi.', 'Rejected, image removed.'));
    } catch {
      setItems((prev) => (prev && !prev.some((entry) => entry.id === item.id)
        ? [...prev, item].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        : prev));
      setErrorMessage(pickLocalized(
        language,
        'Karar kaydedilemedi. Gönderi kuyruğa geri kondu; tekrar dene.',
        'The decision could not be saved. The item is back in the queue; try again.',
      ));
    }
  };

  if (!items) return <NotFound />;

  const visibleItems = items.filter((item) => item.kind === activeKind);
  const countFor = (kind: QueueKind) => items.filter((item) => item.kind === kind).length;
  const tabs: Array<{ kind: QueueKind; label: string }> = [
    { kind: 'gallery', label: pickLocalized(language, 'Galeri', 'Gallery') },
    { kind: 'confession', label: pickLocalized(language, 'İtiraflar', 'Confessions') },
  ];

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-24 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[28px] font-bold uppercase tracking-[0.04em] text-white">
          {pickLocalized(language, 'Moderasyon Kuyruğu', 'Moderation Queue')}
        </h1>
        <button
          type="button"
          onClick={() => void loadQueue()}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-200 hover:border-white/25 disabled:opacity-50"
        >
          <RefreshCcw size={14} aria-hidden="true" className={isRefreshing ? 'animate-spin' : undefined} />
          {pickLocalized(language, 'Yenile', 'Refresh')}
        </button>
      </div>

      <div className="mb-6 inline-flex gap-1 rounded-[10px] border border-white/10 bg-black/30 p-1" role="group">
        {tabs.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            aria-pressed={activeKind === tab.kind}
            onClick={() => setActiveKind(tab.kind)}
            className={`rounded-lg px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] ${
              activeKind === tab.kind ? 'border border-white/15 bg-[#152034] font-semibold text-white' : 'text-slate-400'
            }`}
          >
            {tab.label} ({countFor(tab.kind)})
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite" role="status">{statusMessage}</p>
      <div aria-live="assertive">
        {errorMessage && (
          <div role="alert" className="mb-6 rounded-lg border border-red-500/25 bg-red-500/8 p-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-red-300">
              {pickLocalized(language, 'Hata', 'Error')}
            </p>
            <p className="mt-1 text-sm text-red-200">{errorMessage}</p>
          </div>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 py-16 text-center text-sm text-slate-400">
          {pickLocalized(language, 'Bekleyen gönderi yok.', 'Nothing is waiting for review.')}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visibleItems.map((item) => {
            const noteId = `moderation-note-${item.id}`;
            return (
              <li key={item.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#101A2F] p-5">
                {item.imageUrl && (
                  <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" className="block bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary user upload preview */}
                    <img
                      src={item.imageUrl}
                      alt={item.title || pickLocalized(language, 'Gönderi görseli', 'Submission image')}
                      loading="lazy"
                      className="max-h-80 w-full object-contain"
                    />
                  </a>
                )}
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                  <span className="rounded-full border border-white/15 px-2 py-1">{item.type}</span>
                  <time dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString(language === 'en' ? 'en-GB' : 'tr-TR')}
                  </time>
                </div>
                {item.title && (
                  <h2 className="font-display text-lg font-semibold uppercase tracking-[0.04em] text-white">{item.title}</h2>
                )}
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-300">{item.text}</p>
                <label htmlFor={noteId} className="text-[13px] font-semibold text-slate-300">
                  {pickLocalized(language, 'Ret notu (isteğe bağlı)', 'Rejection note (optional)')}
                </label>
                <input
                  id={noteId}
                  type="text"
                  maxLength={500}
                  value={notes[item.id] ?? ''}
                  onChange={(event) => setNotes((prev) => ({ ...prev, [item.id]: event.target.value }))}
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-[rgba(255,0,51,0.6)] focus:outline-none"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void decide(item, 'APPROVE')}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-emerald-100 hover:bg-emerald-500/20"
                  >
                    <Check size={14} aria-hidden="true" /> {pickLocalized(language, 'Onayla', 'Approve')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void decide(item, 'REJECT')}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-slate-200 hover:border-red-500/40 hover:text-red-200"
                  >
                    <X size={14} aria-hidden="true" /> {pickLocalized(language, 'Reddet', 'Reject')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
