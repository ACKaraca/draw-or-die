'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gavel, Lock } from 'lucide-react';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { PeerReviewStep } from '@/components/PeerReviewStep';

interface MySubmission {
  id: string;
  title: string;
  publicUrl: string;
  juryQuote: string;
}

export default function PeerReviewPage() {
  const language = useLanguage();
  const { user, profile, loading: authLoading } = useAuth();
  const [mySubmissions, setMySubmissions] = useState<MySubmission[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);

  const rapidoBalance = profile?.rapido_pens ?? 0;

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setSubsLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const jwt = await account.createJWT();
        const res = await fetch('/api/gallery?mine=true&limit=50', {
          headers: { Authorization: `Bearer ${jwt.jwt}` },
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json() as {
          items: Array<{ id: string; title: string; img: string; jury: string }>;
        };
        if (!cancelled) {
          setMySubmissions(
            (data.items ?? []).map((item) => ({
              id: item.id,
              title: item.title,
              publicUrl: item.img,
              juryQuote: item.jury,
            })),
          );
        }
      } catch {
        // non-critical; PeerReviewStep handles empty submissions gracefully
      } finally {
        if (!cancelled) setSubsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authLoading, user]);

  if (authLoading || subsLoading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="font-mono text-slate-400">{pickLocalized(language, 'Yükleniyor...', 'Loading...')}</div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <Lock className="mx-auto mb-4 text-blue-400" size={48} />
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider mb-2">
            {pickLocalized(language, 'Giriş Gerekli', 'Sign-in Required')}
          </h1>
          <p className="text-slate-400 mb-6">
            {pickLocalized(language, 'Akran değerlendirmesine katılmak için giriş yapmalısınız.', 'You must sign in to participate in peer review.')}
          </p>
          <Link href="/" className="inline-block bg-white text-black px-6 py-3 uppercase font-bold tracking-wider rounded">
            {pickLocalized(language, 'Ana Sayfa', 'Home')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 text-blue-400 font-mono text-xs uppercase tracking-widest mb-3">
          <Gavel size={16} /> {pickLocalized(language, 'Akran Jürisi', 'Peer Review')}
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-wider mb-2">
          {pickLocalized(language, 'Öğrenci Jürisi', 'Student Jury')}
        </h1>
        <p className="text-slate-400 max-w-2xl leading-relaxed mb-10">
          {pickLocalized(
            language,
            'Projeni akranlara aç, başkalarını değerlendir. Her yorum için +0.25 rapido kazan.',
            'Open your project to peers, review others. Earn +0.25 rapido per comment.',
          )}
        </p>

        <PeerReviewStep
          userSubmissions={mySubmissions}
          rapidoBalance={rapidoBalance}
        />
      </section>
    </main>
  );
}
