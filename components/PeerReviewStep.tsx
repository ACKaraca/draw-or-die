'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Star,
  Send,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Loader2,
  Gavel,
  MessageSquare,
  Coins,
} from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { account } from '@/lib/appwrite';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserSubmission {
  id: string;
  title: string;
  publicUrl: string;
  juryQuote: string;
}

export interface PeerReviewStepProps {
  userSubmissions: UserSubmission[];
  rapidoBalance: number;
  onRapidoChange?: (newBalance: number) => void;
}

interface OpeningItem {
  id: string;
  submissionId: string;
  title: string;
  juryQuote: string;
  publicUrl: string;
  ownerDisplay: string;
  reviewCount: number;
  maxReviews: number;
  openedAt: string;
}

interface OpenedProject {
  id: string;
  submissionId: string;
  status: string;
  reviewCount: number;
  maxReviews: number;
  openedAt: string;
}

interface RapidoToast {
  id: number;
  earned: number;
}

type ActiveTab = 'open' | 'review';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getJwt(): Promise<string> {
  const jwt = await account.createJWT();
  return jwt.jwt;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StarRating({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value ?? 0;

  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} yıldız`}
          className="focus:outline-none"
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => onChange(n)}
        >
          <Star
            size={18}
            className={
              n <= display
                ? 'text-amber-400 fill-amber-400'
                : 'text-slate-600'
            }
          />
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1 — Open for Review
// ---------------------------------------------------------------------------

interface OpenTabProps {
  userSubmissions: UserSubmission[];
  rapidoBalance: number;
  onRapidoChange?: (newBalance: number) => void;
}

function OpenTab({ userSubmissions, rapidoBalance, onRapidoChange }: OpenTabProps) {
  const language = useLanguage();

  // submissionId -> OpenedProject (after user opens it)
  const [openedMap, setOpenedMap] = useState<Record<string, OpenedProject>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState(rapidoBalance);

  // Sync balance from props when it changes externally
  useEffect(() => {
    setCurrentBalance(rapidoBalance);
  }, [rapidoBalance]);

  const handleOpen = useCallback(
    async (submissionId: string) => {
      setErrorMsg(null);
      setLoadingId(submissionId);

      try {
        const jwt = await getJwt();
        const res = await fetch('/api/peer-review/open', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${jwt}`,
          },
          body: JSON.stringify({ submissionId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? `HTTP ${res.status}`);
        }

        const data: { opening: OpenedProject; rapido_remaining: number } = await res.json();

        setOpenedMap((prev) => ({ ...prev, [submissionId]: data.opening }));
        setCurrentBalance(data.rapido_remaining);
        onRapidoChange?.(data.rapido_remaining);
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Bilinmeyen hata / Unknown error';
        setErrorMsg(msg);
      } finally {
        setLoadingId(null);
      }
    },
    [onRapidoChange],
  );

  if (userSubmissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <Gavel size={40} className="text-slate-600" />
        <p className="font-mono text-slate-400 text-sm">
          {pickLocalized(
            language,
            'Önce bir proje analiz etmelisin.',
            'You need to analyze a project first.',
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Balance display */}
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-400/10 border border-amber-400/20 rounded-lg w-fit">
        <Coins size={16} className="text-amber-400" />
        <span className="font-mono text-sm text-amber-300">
          {pickLocalized(language, 'Mevcut bakiye', 'Current balance')}:{' '}
          <strong>{currentBalance}</strong> rapido
        </span>
      </div>

      <p className="font-mono text-xs text-slate-500">
        {pickLocalized(
          language,
          'Her proje açma 2 rapido harcar.',
          'Opening each project costs 2 rapido.',
        )}
      </p>

      {errorMsg && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 font-mono text-xs"
        >
          {errorMsg}
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {userSubmissions.map((sub, i) => {
          const opened = openedMap[sub.id];
          const isLoading = loadingId === sub.id;

          return (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#111827] border border-white/10 rounded-xl overflow-hidden flex flex-col"
            >
              {/* Thumbnail */}
              <div className="h-44 overflow-hidden relative bg-black/40">
                <img
                  src={sub.publicUrl}
                  alt={sub.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="p-4 flex flex-col gap-3 flex-1">
                <h3 className="font-display font-bold text-white text-sm leading-tight line-clamp-2">
                  {sub.title}
                </h3>
                <p className="font-mono text-xs text-slate-400 line-clamp-3 italic">
                  &ldquo;{sub.juryQuote}&rdquo;
                </p>

                <div className="mt-auto pt-3">
                  {opened ? (
                    <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs">
                      <CheckCircle size={14} />
                      {pickLocalized(language, 'Zaten açık', 'Already open')}
                      {' '}
                      <span className="text-slate-500">
                        ({opened.reviewCount}/{opened.maxReviews})
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpen(sub.id)}
                      disabled={isLoading || currentBalance < 2}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/30 disabled:cursor-not-allowed text-black font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
                    >
                      {isLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Gavel size={14} />
                      )}
                      {pickLocalized(language, 'Jüriye Aç', 'Open for Review')}
                      {' '}
                      <span className="opacity-70">(−2 rapido)</span>
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 2 — Review Others
// ---------------------------------------------------------------------------

interface ReviewedEntry {
  openingId: string;
  body: string;
}

interface ReviewCardProps {
  opening: OpeningItem;
  index: number;
  onReviewed: (entry: ReviewedEntry) => void;
  onToast: (earned: number) => void;
}

function ReviewCard({ opening, index, onReviewed, onToast }: ReviewCardProps) {
  const language = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [postedComment, setPostedComment] = useState<string | null>(null);

  const bodyLen = body.trim().length;
  const canSubmit = bodyLen >= 10 && bodyLen <= 1000 && !isSubmitting;

  const handleSubmit = async () => {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const jwt = await getJwt();
      const payload: { body: string; rating?: number } = { body: body.trim() };
      if (rating !== null) payload.rating = rating;

      const res = await fetch(`/api/peer-review/${opening.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      const data: { review: unknown; rapido_earned: number } = await res.json();

      setPostedComment(body.trim());
      setDone(true);
      setExpanded(false);
      onReviewed({ openingId: opening.id, body: body.trim() });
      onToast(data.rapido_earned);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Bilinmeyen hata / Unknown error';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-[#111827] border border-white/10 rounded-xl overflow-hidden flex flex-col"
    >
      {/* Thumbnail */}
      <div className="h-48 overflow-hidden relative bg-black/40">
        <img
          src={opening.publicUrl}
          alt={opening.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-2 right-2">
          <span className="bg-black/70 border border-white/10 text-slate-300 font-mono text-xs px-2 py-1 rounded-full">
            {opening.reviewCount}/{opening.maxReviews}
          </span>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <h3 className="font-display font-bold text-white text-sm leading-tight line-clamp-2">
          {opening.title}
        </h3>
        <p className="font-mono text-xs text-slate-400 line-clamp-3 italic">
          &ldquo;{opening.juryQuote}&rdquo;
        </p>

        {/* "Done" state: show posted comment */}
        {done && postedComment && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3"
          >
            <div className="flex items-center gap-1.5 mb-1.5 text-emerald-400 font-mono text-xs font-bold">
              <CheckCircle size={12} />
              {pickLocalized(language, 'Yorumlandı', 'Reviewed')} ✓
            </div>
            <p className="text-slate-300 text-xs font-sans leading-relaxed">
              {postedComment}
            </p>
          </motion.div>
        )}

        {/* Expand / collapse comment form */}
        {!done && (
          <div className="mt-auto pt-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 border border-amber-400/30 bg-amber-400/5 hover:bg-amber-400/10 rounded-lg text-amber-300 font-mono text-xs transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <MessageSquare size={13} />
                {pickLocalized(language, 'Yorum Yaz', 'Write a Comment')}
              </span>
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 flex flex-col gap-3">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder={pickLocalized(
                        language,
                        'En az 10, en fazla 1000 karakter...',
                        'Between 10 and 1000 characters...',
                      )}
                      rows={4}
                      className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/50 resize-none font-sans"
                    />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          {pickLocalized(language, 'Puan (opsiyonel)', 'Rating (optional)')}:
                        </span>
                        <StarRating
                          value={rating}
                          onChange={(v) =>
                            setRating((prev) => (prev === v ? null : v))
                          }
                        />
                      </div>
                      <span
                        className={`font-mono text-xs ${
                          bodyLen > 1000
                            ? 'text-red-400'
                            : bodyLen < 10 && bodyLen > 0
                              ? 'text-amber-400'
                              : 'text-slate-600'
                        }`}
                      >
                        {bodyLen}/1000
                      </span>
                    </div>

                    {submitError && (
                      <p className="text-red-400 font-mono text-xs">{submitError}</p>
                    )}

                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      className="flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/30 disabled:cursor-not-allowed text-black font-bold text-xs uppercase tracking-wider rounded-lg transition-colors"
                    >
                      {isSubmitting ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Send size={13} />
                      )}
                      {pickLocalized(language, 'Gönder', 'Submit')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PeerReviewStep({
  userSubmissions,
  rapidoBalance,
  onRapidoChange,
}: PeerReviewStepProps) {
  const language = useLanguage();
  const [activeTab, setActiveTab] = useState<ActiveTab>('open');

  // Tab 2 state
  const [openings, setOpenings] = useState<OpeningItem[]>([]);
  const [openingsLoading, setOpeningsLoading] = useState(false);
  const [openingsError, setOpeningsError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

  // Toast queue
  const [toasts, setToasts] = useState<RapidoToast[]>([]);

  const fetchOpenings = useCallback(async () => {
    setOpeningsLoading(true);
    setOpeningsError(null);

    try {
      const jwt = await getJwt();
      const res = await fetch('/api/peer-review', {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      const data: { openings: OpeningItem[] } = await res.json();
      setOpenings(data.openings ?? []);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Bilinmeyen hata / Unknown error';
      setOpeningsError(msg);
    } finally {
      setOpeningsLoading(false);
    }
  }, []);

  // Fetch openings when user switches to review tab for the first time
  const [hasFetchedOpenings, setHasFetchedOpenings] = useState(false);

  useEffect(() => {
    if (activeTab === 'review' && !hasFetchedOpenings) {
      setHasFetchedOpenings(true);
      fetchOpenings();
    }
  }, [activeTab, hasFetchedOpenings, fetchOpenings]);

  const handleReviewed = useCallback((entry: ReviewedEntry) => {
    setReviewed((prev) => new Set([...prev, entry.openingId]));
  }, []);

  const addToast = useCallback((earned: number) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, earned }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <motion.div
      key="peer-review"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-5xl flex flex-col gap-8"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-wider text-white flex items-center justify-center gap-3 mb-3">
          <Users className="text-amber-400" size={32} />
          {pickLocalized(language, 'Akran Değerlendirme', 'Peer Review')}
        </h2>
        <p className="font-mono text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
          {pickLocalized(
            language,
            'Projelerini jüriye aç ve diğer öğrencileri değerlendirerek rapido kazan.',
            'Open your projects for jury review and earn rapido by reviewing others.',
          )}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl w-fit mx-auto">
        <button
          onClick={() => setActiveTab('open')}
          className={`px-5 py-2.5 rounded-lg font-mono text-sm font-semibold transition-all ${
            activeTab === 'open'
              ? 'bg-amber-400 text-black shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {pickLocalized(language, 'Projeyi Aç', 'Open Project')}
        </button>
        <button
          onClick={() => setActiveTab('review')}
          className={`px-5 py-2.5 rounded-lg font-mono text-sm font-semibold transition-all ${
            activeTab === 'review'
              ? 'bg-amber-400 text-black shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          {pickLocalized(language, 'Diğerlerini Değerlendir', 'Review Others')}
        </button>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'open' && (
          <motion.div
            key="tab-open"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <OpenTab
              userSubmissions={userSubmissions}
              rapidoBalance={rapidoBalance}
              onRapidoChange={onRapidoChange}
            />
          </motion.div>
        )}

        {activeTab === 'review' && (
          <motion.div
            key="tab-review"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {openingsLoading && (
              <div className="flex items-center justify-center py-20 gap-3 text-slate-400 font-mono text-sm">
                <Loader2 size={20} className="animate-spin text-amber-400" />
                {pickLocalized(language, 'Yükleniyor...', 'Loading...')}
              </div>
            )}

            {openingsError && !openingsLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <p className="text-red-400 font-mono text-sm text-center max-w-sm">
                  {pickLocalized(language, 'Hata: ', 'Error: ')}
                  {openingsError}
                </p>
                <button
                  onClick={fetchOpenings}
                  className="px-4 py-2 border border-white/20 rounded-lg text-sm font-mono text-slate-300 hover:bg-white/5 transition-colors"
                >
                  {pickLocalized(language, 'Tekrar Dene', 'Retry')}
                </button>
              </div>
            )}

            {!openingsLoading && !openingsError && openings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <MessageSquare size={40} className="text-slate-600" />
                <p className="font-mono text-slate-400 text-sm">
                  {pickLocalized(
                    language,
                    'Henüz değerlendirilecek proje yok.',
                    'No projects to review yet.',
                  )}
                </p>
              </div>
            )}

            {!openingsLoading && !openingsError && openings.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {openings.map((opening, i) => (
                  <ReviewCard
                    key={opening.id}
                    opening={opening}
                    index={i}
                    onReviewed={handleReviewed}
                    onToast={addToast}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rapido earned toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.9 }}
              className="bg-[#111827] border border-amber-400/40 rounded-xl px-5 py-3 shadow-2xl flex items-center gap-3"
            >
              <Coins size={18} className="text-amber-400" />
              <span className="font-mono text-sm text-white font-semibold">
                +{toast.earned} rapido{' '}
                {pickLocalized(language, 'kazandın', 'earned')} 🎉
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
