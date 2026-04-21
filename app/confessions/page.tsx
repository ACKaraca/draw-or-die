'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { BookHeart, Flame, Loader2, Send, ShieldCheck, Upload, X } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfessionItem {
  id: string;
  text: string;
  imageUrl?: string;
  likes: number;
  createdAt: string;
}

interface FeedResponse {
  confessions: ConfessionItem[];
  total: number;
}

type SortMode = 'hot' | 'new';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(isoDate: string, language: 'tr' | 'en'): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return language === 'tr' ? 'az önce' : 'just now';
  if (mins < 60) return language === 'tr' ? `${mins} dk önce` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return language === 'tr' ? `${hrs} saat önce` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return language === 'tr' ? `${days} gün önce` : `${days}d ago`;
}

function getOrCreateAnonKey(): string {
  if (typeof window === 'undefined') return '';
  let key = localStorage.getItem('confession_anon_key');
  if (!key) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    localStorage.setItem('confession_anon_key', key);
  }
  return key;
}

function getLikedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem('confession_liked_ids');
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function addLikedId(id: string): void {
  if (typeof window === 'undefined') return;
  const ids = getLikedIds();
  ids.add(id);
  localStorage.setItem('confession_liked_ids', JSON.stringify(Array.from(ids)));
}

const MAX_CHARS = 2000;
const MIN_CHARS = 10;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const COOLDOWN_SECONDS = 30;
const PAGE_LIMIT = 20;

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface ToastProps {
  message: string;
  variant: 'success' | 'error';
  onDismiss: () => void;
}

function Toast({ message, variant, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border font-mono text-sm ${
        variant === 'success'
          ? 'bg-[#111827] border-purple-500/40 text-white'
          : 'bg-[#111827] border-red-500/40 text-red-300'
      }`}
    >
      {message}
      <button onClick={onDismiss} className="text-slate-500 hover:text-white transition-colors">
        <X size={14} />
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Confession Card
// ---------------------------------------------------------------------------

interface ConfessionCardProps {
  confession: ConfessionItem;
  liked: boolean;
  onLike: (id: string) => void;
  language: 'tr' | 'en';
}

function ConfessionCard({ confession, liked, onLike, language }: ConfessionCardProps) {
  return (
    <motion.div
      key={confession.id}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25 }}
      className="bg-black/60 border border-white/5 rounded-xl overflow-hidden hover:border-purple-500/20 transition-colors"
    >
      {confession.imageUrl && (
        <div className="w-full max-h-64 overflow-hidden">
          <Image
            src={confession.imageUrl}
            alt=""
            width={600}
            height={400}
            className="w-full max-h-64 object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <p className="text-white font-sans text-base md:text-lg italic leading-relaxed mb-4">
          &ldquo;{confession.text}&rdquo;
        </p>
        <div className="flex items-center justify-between text-slate-500 font-mono text-xs">
          <span>{timeAgo(confession.createdAt, language)}</span>
          <button
            onClick={() => onLike(confession.id)}
            disabled={liked}
            aria-label={liked ? 'Already liked' : 'Like this confession'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${
              liked
                ? 'bg-purple-500/15 border border-purple-500/30 text-purple-300 cursor-default'
                : 'bg-white/5 hover:bg-purple-500/15 hover:text-purple-300 border border-transparent hover:border-purple-500/30'
            }`}
          >
            <Flame
              size={13}
              className={liked || confession.likes > 50 ? 'text-orange-400' : ''}
              fill={liked ? 'currentColor' : 'none'}
            />
            <span>{confession.likes}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ConfessionsPage() {
  const language = useLanguage();

  // ---------- submit form state ----------
  const [text, setText] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------- toast ----------
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  // ---------- feed state ----------
  const [sort, setSort] = useState<SortMode>('hot');
  const [confessions, setConfessions] = useState<ConfessionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [feedLoading, setFeedLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // Initialise liked IDs from localStorage on mount
  useEffect(() => {
    setLikedIds(getLikedIds());
  }, []);

  // ---------- cooldown ticker ----------
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ---------- fetch feed ----------
  const fetchFeed = useCallback(async (pageNum: number, sortMode: SortMode, replace: boolean) => {
    if (replace) setFeedLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_LIMIT),
        sort: sortMode,
      });
      const res = await fetch(`/api/confessions?${params.toString()}`);
      if (!res.ok) throw new Error('fetch failed');
      const data = (await res.json()) as FeedResponse;

      setConfessions((prev) =>
        replace ? data.confessions : [...prev, ...data.confessions],
      );
      setTotal(data.total);
    } catch {
      // silent
    } finally {
      setFeedLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load + when sort changes
  useEffect(() => {
    setPage(1);
    void fetchFeed(1, sort, true);
  }, [sort, fetchFeed]);

  // ---------- image upload ----------
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setImageError(
        pickLocalized(language, 'Dosya 5 MB sınırını aşıyor.', 'File exceeds the 5 MB limit.'),
      );
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const dataUrl = evt.target?.result as string;
      // dataUrl is "data:<mimeType>;base64,<data>"
      const [meta, base64] = dataUrl.split(',');
      const mimeMatch = meta.match(/data:([^;]+);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      setImageBase64(base64 ?? null);
      setImageMimeType(mime);
      setImagePreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }, [language]);

  const clearImage = useCallback(() => {
    setImageBase64(null);
    setImageMimeType(null);
    setImagePreview(null);
    setImageError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  // ---------- submit confession ----------
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < MIN_CHARS || submitting || cooldown > 0) return;

    setSubmitting(true);
    try {
      const anonKey = getOrCreateAnonKey();
      const body: Record<string, unknown> = { text: text.trim(), anonKey };
      if (imageBase64 && imageMimeType) {
        body.imageBase64 = imageBase64;
        body.imageMimeType = imageMimeType;
      }

      const res = await fetch('/api/confessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        ok: boolean;
        rejected?: boolean;
        confession?: ConfessionItem;
      };

      if (data.ok && !data.rejected) {
        setToast({
          message: pickLocalized(language, 'İtirafın yayınlandı!', 'Your confession is live!'),
          variant: 'success',
        });
        setText('');
        clearImage();
        startCooldown();
        // Prepend to feed if we're on "new" sort or just refresh
        if (data.confession) {
          setConfessions((prev) => [data.confession as ConfessionItem, ...prev]);
          setTotal((t) => t + 1);
        }
      } else {
        setToast({
          message: pickLocalized(language, 'Moderasyondan geçemedi.', "Didn't pass moderation."),
          variant: 'error',
        });
      }
    } catch {
      setToast({
        message: pickLocalized(language, 'Bir hata oluştu.', 'Something went wrong.'),
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, cooldown, imageBase64, imageMimeType, language, clearImage, startCooldown]);

  // ---------- like ----------
  const handleLike = useCallback(async (id: string) => {
    if (likedIds.has(id)) return;

    // Optimistic update
    setConfessions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, likes: c.likes + 1 } : c)),
    );
    setLikedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    addLikedId(id);

    try {
      const anonKey = getOrCreateAnonKey();
      await fetch(`/api/confessions/${id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonKey }),
      });
    } catch {
      // revert on error
      setConfessions((prev) =>
        prev.map((c) => (c.id === id ? { ...c, likes: Math.max(0, c.likes - 1) } : c)),
      );
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [likedIds]);

  // ---------- load more ----------
  const handleLoadMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    void fetchFeed(nextPage, sort, false);
  }, [page, sort, fetchFeed]);

  const hasMore = confessions.length < total;
  const submitDisabled = text.trim().length < MIN_CHARS || submitting || cooldown > 0;

  // language narrowed to tr|en for timeAgo
  const lang = language === 'en' ? 'en' : 'tr';

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 pt-24 flex flex-col gap-10">

        {/* ------------------------------------------------------------------ */}
        {/* Header                                                              */}
        {/* ------------------------------------------------------------------ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center text-center gap-3"
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 mb-1">
            <BookHeart size={28} className="text-purple-400" />
          </div>
          <h1 className="font-display text-3xl sm:text-4xl uppercase tracking-wider font-bold text-white">
            {pickLocalized(language, 'Stüdyo İtirafları', 'Studio Confessions')}
          </h1>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <ShieldCheck size={14} className="text-purple-400 shrink-0" />
            <span>
              {pickLocalized(
                language,
                'Tamamen anonim. Yapay zeka moderasyonu.',
                'Completely anonymous. AI-moderated.',
              )}
            </span>
          </div>
        </motion.div>

        {/* ------------------------------------------------------------------ */}
        {/* Submit Form                                                         */}
        {/* ------------------------------------------------------------------ */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="bg-[#111827] border border-purple-500/20 rounded-2xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl"
        >
          {/* Textarea + char counter */}
          <div className="relative">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              placeholder={pickLocalized(
                language,
                'İçini dök... (Anonim gönderilecektir)',
                'Vent it out... (Will be posted anonymously)',
              )}
              rows={4}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500/50 transition-colors resize-none text-sm leading-relaxed"
            />
            <span
              className={`absolute bottom-3 right-3 font-mono text-[10px] ${
                text.length > MAX_CHARS - 100 ? 'text-orange-400' : 'text-slate-600'
              }`}
            >
              {text.length}/{MAX_CHARS}
            </span>
          </div>

          {/* Image upload */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <label
                htmlFor="confession-image"
                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-400 hover:text-white font-mono text-xs uppercase tracking-widest cursor-pointer transition-colors"
              >
                <Upload size={13} />
                {pickLocalized(language, 'Görsel Ekle', 'Add Image')}
                <input
                  ref={fileInputRef}
                  id="confession-image"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              {imagePreview && (
                <button
                  type="button"
                  onClick={clearImage}
                  className="flex items-center gap-1.5 px-2.5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-red-400 font-mono text-xs transition-colors"
                >
                  <X size={12} />
                  {pickLocalized(language, 'Kaldır', 'Remove')}
                </button>
              )}
            </div>
            {imageError && (
              <p className="font-mono text-xs text-red-400">{imageError}</p>
            )}
            {imagePreview && (
              <div className="rounded-lg overflow-hidden border border-white/10 max-h-40">
                <Image
                  src={imagePreview}
                  alt="preview"
                  width={400}
                  height={300}
                  className="w-full max-h-40 object-cover"
                  unoptimized
                />
              </div>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitDisabled}
            className="flex items-center justify-center gap-2 w-full py-3.5 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-mono text-xs uppercase tracking-widest font-bold transition-colors"
          >
            {submitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Send size={15} />
            )}
            {cooldown > 0
              ? pickLocalized(language, `${cooldown}s bekle...`, `Wait ${cooldown}s...`)
              : pickLocalized(language, 'İtiraf Et', 'Submit Confession')}
          </button>
        </motion.form>

        {/* ------------------------------------------------------------------ */}
        {/* Feed                                                                */}
        {/* ------------------------------------------------------------------ */}
        <div className="flex flex-col gap-6">

          {/* Sort tabs */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            {(['hot', 'new'] as SortMode[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-colors border ${
                  sort === s
                    ? 'bg-purple-500/15 border-purple-500/40 text-purple-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {s === 'hot' ? '🔥' : '🆕'}
                &nbsp;
                {s === 'hot'
                  ? pickLocalized(language, 'Popüler', 'Popular')
                  : pickLocalized(language, 'Yeni', 'New')}
              </button>
            ))}
            <span className="ml-auto font-mono text-xs text-slate-600">
              {total} {pickLocalized(language, 'itiraf', 'confessions')}
            </span>
          </div>

          {/* Confessions list */}
          {feedLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="text-purple-400 animate-spin" />
            </div>
          ) : confessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-2xl"
            >
              <BookHeart size={36} className="text-slate-700 mb-3" />
              <p className="font-mono text-xs text-slate-500 uppercase tracking-widest">
                {pickLocalized(language, 'Henüz itiraf yok', 'No confessions yet')}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="flex flex-col gap-4">
                {confessions.map((confession) => (
                  <ConfessionCard
                    key={confession.id}
                    confession={confession}
                    liked={likedIds.has(confession.id)}
                    onLike={handleLike}
                    language={lang}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}

          {/* Load more */}
          {hasMore && !feedLoading && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 font-mono text-xs uppercase tracking-widest transition-colors disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                {pickLocalized(language, 'Daha fazla yükle', 'Load more')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <Toast
            key="toast"
            message={toast.message}
            variant={toast.variant}
            onDismiss={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
