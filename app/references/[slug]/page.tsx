'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Markdown from 'react-markdown';
import { motion } from 'framer-motion';
import { ArrowLeft, Crown, Lock, MapPin, Ruler } from 'lucide-react';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

interface ReferenceDetail {
  id: string;
  slug: string;
  title: string;
  architect: string;
  year: number | null;
  location: string;
  typology: string;
  summary: string;
  analysisMd: string;
  coverImageUrl: string;
  planImageUrls: string[];
  sectionImageUrls: string[];
  tags: string[];
}

export default function ReferenceDetailPage() {
  const params = useParams<{ slug: string }>();
  const language = useLanguage();
  const { user, profile, loading: authLoading } = useAuth();
  const [reference, setReference] = useState<ReferenceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPremium = Boolean(profile?.is_premium);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isPremium || !params?.slug) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const jwt = await account.createJWT();
        const res = await fetch(`/api/references/${encodeURIComponent(params.slug)}`, {
          headers: {
            Authorization: `Bearer ${jwt.jwt}`,
            'Accept-Language': language === 'tr' ? 'tr' : 'en',
          },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load');
        }
        const data = await res.json() as { reference: ReferenceDetail };
        if (!cancelled) setReference(data.reference);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, isPremium, params?.slug, language]);

  if (authLoading || loading) {
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
          <Lock className="mx-auto mb-4 text-amber-400" size={48} />
          <p className="text-slate-400 mb-6">{pickLocalized(language, 'Giriş gerekli.', 'Sign-in required.')}</p>
          <Link href="/" className="bg-white text-black px-6 py-3 uppercase font-bold tracking-wider rounded">
            {pickLocalized(language, 'Ana Sayfa', 'Home')}
          </Link>
        </div>
      </main>
    );
  }

  if (!isPremium) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-lg text-center bg-[#111827] border border-amber-400/30 rounded-2xl p-10">
          <Crown className="mx-auto mb-4 text-amber-400" size={48} />
          <p className="text-slate-400 mb-6">{pickLocalized(language, 'Premium üyelere özeldir.', 'Premium members only.')}</p>
          <Link href="/shop" className="inline-block bg-amber-400 text-black px-6 py-3 uppercase font-bold tracking-wider rounded">
            {pickLocalized(language, 'Premium Al', 'Go Premium')}
          </Link>
        </div>
      </main>
    );
  }

  if (error || !reference) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-red-400 font-mono mb-4">{error || pickLocalized(language, 'Referans bulunamadı.', 'Reference not found.')}</p>
          <Link href="/references" className="text-amber-400 hover:underline">
            {pickLocalized(language, 'Kütüphaneye dön', 'Back to library')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/references" className="inline-flex items-center gap-2 text-slate-400 hover:text-white font-mono text-xs uppercase tracking-widest mb-8">
          <ArrowLeft size={14} /> {pickLocalized(language, 'Tüm referanslar', 'All references')}
        </Link>

        <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-8">
            <div className="text-amber-400 font-mono text-xs uppercase tracking-widest mb-2">
              {reference.architect}{reference.year ? ` · ${reference.year}` : ''}
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-wider mb-3 leading-tight">
              {reference.title}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-slate-400 font-mono">
              {reference.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} /> {reference.location}
                </span>
              )}
              {reference.typology && (
                <span className="flex items-center gap-1">
                  <Ruler size={14} /> {reference.typology}
                </span>
              )}
            </div>
          </div>

          {reference.coverImageUrl && (
            <div className="mb-10 rounded-2xl overflow-hidden border border-white/10">
              <Image
                src={reference.coverImageUrl}
                alt={reference.title}
                width={1200}
                height={675}
                className="w-full h-auto"
                priority
              />
            </div>
          )}

          <p className="text-lg text-slate-300 leading-relaxed mb-10 border-l-2 border-amber-400 pl-4 italic">
            {reference.summary}
          </p>

          {reference.planImageUrls.length > 0 && (
            <section className="mb-10">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider mb-4 text-amber-400">
                {pickLocalized(language, 'Plan Analizleri', 'Plan analyses')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reference.planImageUrls.map((url, idx) => (
                  <Image
                    key={idx}
                    src={url}
                    alt={`Plan ${idx + 1}`}
                    width={800}
                    height={600}
                    className="w-full h-auto rounded-xl border border-white/10"
                  />
                ))}
              </div>
            </section>
          )}

          {reference.sectionImageUrls.length > 0 && (
            <section className="mb-10">
              <h2 className="font-display text-xl font-bold uppercase tracking-wider mb-4 text-amber-400">
                {pickLocalized(language, 'Kesit Analizleri', 'Section analyses')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reference.sectionImageUrls.map((url, idx) => (
                  <Image
                    key={idx}
                    src={url}
                    alt={`Section ${idx + 1}`}
                    width={800}
                    height={600}
                    className="w-full h-auto rounded-xl border border-white/10"
                  />
                ))}
              </div>
            </section>
          )}

          <div className="prose prose-invert prose-slate max-w-none">
            <Markdown>{reference.analysisMd}</Markdown>
          </div>

          {reference.tags.length > 0 && (
            <div className="mt-10 pt-6 border-t border-white/10 flex flex-wrap gap-2">
              {reference.tags.map((tag) => (
                <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-slate-400">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </motion.article>
      </section>
    </main>
  );
}
