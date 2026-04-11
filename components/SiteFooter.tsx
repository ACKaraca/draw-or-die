'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { useAuth } from '@/hooks/useAuth';
import { account } from '@/lib/appwrite';

type FeedbackCategory = 'general' | 'bug' | 'feature' | 'ux' | 'billing';

export function SiteFooter() {
  const year = new Date().getFullYear();
  const pathname = usePathname();
  const { user } = useAuth();
  const language = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [rating, setRating] = useState<number>(5);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  const handleSubmitFeedback = async () => {
    const trimmed = message.trim();
    if (trimmed.length < 8) {
      setNotice(pickLocalized(language, 'Lutfen en az 8 karakterlik geri bildirim yazin.', 'Please write at least 8 characters for feedback.'));
      return;
    }

    setSubmitting(true);
    setNotice(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (user) {
        try {
          const jwt = await account.createJWT();
          headers.Authorization = `Bearer ${jwt.jwt}`;
        } catch {
          // Continue as unauthenticated feedback if JWT creation fails.
        }
      }

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          message: trimmed,
          category,
          rating,
          sourcePath: pathname || '/',
          context: {
            viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : null,
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        setNotice(payload.error || pickLocalized(language, 'Geri bildirim gonderilemedi.', 'Feedback could not be sent.'));
        return;
      }

      setMessage('');
      setRating(5);
      setCategory('general');
      setNotice(pickLocalized(language, 'Tesekkurler! Geri bildiriminiz kaydedildi.', 'Thanks! Your feedback has been saved.'));
      setIsOpen(false);
    } catch {
      setNotice(pickLocalized(language, 'Geri bildirim gonderilemedi. Lutfen tekrar deneyin.', 'Feedback could not be sent. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="w-full border-t border-white/10 bg-[#0A0F1A]/90 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-400 font-mono">
            Copyright © {year} Draw or Die. {pickLocalized(language, 'Tum haklari saklidir', 'All rights reserved')}. Developed by{' '}
            <a
              href="https://ackaraca.me"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2"
            >
              ackaraca.me
            </a>
            .
          </p>

          <nav className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-wider text-slate-400">
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-cyan-200 hover:bg-cyan-500/20"
            >
              <MessageSquare size={12} /> {pickLocalized(language, 'Geri Bildirim', 'Feedback')}
            </button>
            <Link href="/legal" className="hover:text-white">Legal</Link>
            <Link href="/legal/terms" className="hover:text-white">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/legal/cookies" className="hover:text-white">Cookies</Link>
          </nav>
        </div>

        {isOpen && (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
            <h3 className="text-sm font-mono uppercase tracking-wider text-cyan-200">{pickLocalized(language, 'Hizli Geri Bildirim', 'Quick Feedback')}</h3>
            <p className="mt-1 text-xs text-slate-400">{pickLocalized(language, 'Bu mesaj dogrudan urun gelistirme listesine kaydedilir.', 'This message is directly saved to the product development list.')}</p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-400">
                {pickLocalized(language, 'Kategori', 'Category')}
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="general">{pickLocalized(language, 'Genel', 'General')}</option>
                  <option value="bug">{pickLocalized(language, 'Hata', 'Bug')}</option>
                  <option value="feature">{pickLocalized(language, 'Ozellik istegi', 'Feature request')}</option>
                  <option value="ux">UX</option>
                  <option value="billing">{pickLocalized(language, 'Odeme', 'Billing')}</option>
                </select>
              </label>

              <label className="text-xs text-slate-400">
                {pickLocalized(language, 'Email (opsiyonel)', 'Email (optional)')}
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>

            <label className="mt-3 block text-xs text-slate-400">
              {pickLocalized(language, 'Mesajiniz', 'Your message')}
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                placeholder={pickLocalized(language, 'Neyi iyilestirmemizi istersin?', 'What should we improve?')}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              />
            </label>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="text-xs text-slate-400">
                {pickLocalized(language, 'Deneyim puani', 'Rating')}
                <select
                  value={rating}
                  onChange={(event) => setRating(Number(event.target.value) || 5)}
                  className="ml-2 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white"
                >
                  <option value={5}>5</option>
                  <option value={4}>4</option>
                  <option value={3}>3</option>
                  <option value={2}>2</option>
                  <option value={1}>1</option>
                </select>
              </label>

              <button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-3 py-2 text-xs font-mono uppercase tracking-wider text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-60"
              >
                <Send size={12} /> {submitting ? pickLocalized(language, 'Gonderiliyor...', 'Sending...') : pickLocalized(language, 'Gonder', 'Send')}
              </button>
            </div>
          </div>
        )}

        {notice && (
          <p className="mt-3 text-xs font-mono text-slate-300">{notice}</p>
        )}
      </div>
    </footer>
  );
}
