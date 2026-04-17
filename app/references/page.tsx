'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookMarked, Crown, Lock, Search, MapPin } from 'lucide-react';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

interface ReferenceCard {
  id: string;
  slug: string;
  title: string;
  architect: string;
  year: number | null;
  location: string;
  typology: string;
  summary: string;
  coverImageUrl: string;
  tags: string[];
}

export default function ReferencesLibraryPage() {
  const language = useLanguage();
  const { user, profile, loading: authLoading } = useAuth();
  const [references, setReferences] = useState<ReferenceCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const isPremium = Boolean(profile?.is_premium);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isPremium) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const jwt = await account.createJWT();
        const res = await fetch('/api/references', {
          headers: {
            Authorization: `Bearer ${jwt.jwt}`,
            'Accept-Language': language === 'tr' ? 'tr' : 'en',
          },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to load');
        }
        const data = await res.json() as { references: ReferenceCard[] };
        if (!cancelled) setReferences(data.references);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, isPremium, language]);

  const filtered = references.filter((r) => {
    if (!query.trim()) return true;
    const needle = query.trim().toLowerCase();
    return (
      r.title.toLowerCase().includes(needle) ||
      r.architect.toLowerCase().includes(needle) ||
      r.typology.toLowerCase().includes(needle) ||
      r.tags.some((t) => t.toLowerCase().includes(needle))
    );
  });

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
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider mb-2">
            {pickLocalized(language, 'Giriş gerekli', 'Sign-in required')}
          </h1>
          <p className="text-slate-400 mb-6">
            {pickLocalized(
              language,
              'Referans Kütüphanesine erişmek için giriş yapmalısınız.',
              'You must sign in to access the Reference Library.',
            )}
          </p>
          <Link href="/" className="inline-block bg-white text-black px-6 py-3 uppercase font-bold tracking-wider rounded">
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
          <h1 className="font-display text-3xl font-bold uppercase tracking-wider mb-2">
            {pickLocalized(language, 'Premium Özel', 'Premium only')}
          </h1>
          <p className="text-slate-400 mb-6 leading-relaxed">
            {pickLocalized(
              language,
              'Peter Zumthor, Tadao Ando ve daha fazlasının plan/kesit analizlerini içeren kilitli kütüphane yalnızca Premium üyelere açıktır.',
              'The locked library of plan/section analyses by Peter Zumthor, Tadao Ando, and others is open only to Premium members.',
            )}
          </p>
          <Link href="/shop" className="inline-block bg-amber-400 text-black px-6 py-3 uppercase font-bold tracking-wider rounded hover:bg-amber-300 transition-colors">
            {pickLocalized(language, 'Premium Al', 'Go Premium')}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-6xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-3 text-amber-400 font-mono text-xs uppercase tracking-widest mb-3">
            <BookMarked size={16} /> {pickLocalized(language, 'Referans Kütüphanesi', 'Reference Library')}
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-wider mb-4">
            {pickLocalized(language, 'Plan & Kesit Analizleri', 'Plan & Section Analyses')}
          </h1>
          <p className="text-slate-400 max-w-2xl leading-relaxed">
            {pickLocalized(
              language,
              'AI’nin önerdiği referansların sadece isimleriyle kalmayın. Her eser için özenle hazırlanmış plan, kesit ve kavramsal analizler.',
              'Do not settle for the names AI suggests. For each work, curated plan, section, and conceptual analyses.',
            )}
          </p>
        </motion.div>

        <div className="mb-8 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="search"
            placeholder={pickLocalized(language, 'Ara: mimar, tipoloji, etiket...', 'Search: architect, typology, tag...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#111827] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-amber-400/50"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 font-mono text-sm rounded p-4 mb-6">{error}</div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500 font-mono">
            {pickLocalized(language, 'Henüz referans eklenmedi.', 'No references yet.')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((r) => (
              <Link
                key={r.id}
                href={`/references/${r.slug}`}
                className="bg-[#111827] border border-white/10 rounded-2xl overflow-hidden hover:border-amber-400/40 transition-all group"
              >
                <div className="aspect-[4/3] bg-slate-900 overflow-hidden relative">
                  {r.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverImageUrl} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <BookMarked size={48} />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <div className="text-[11px] uppercase tracking-widest font-mono text-amber-400 mb-1">{r.architect}{r.year ? ` · ${r.year}` : ''}</div>
                  <h3 className="font-display text-xl font-bold uppercase tracking-wide mb-2 leading-tight">{r.title}</h3>
                  {r.location && (
                    <div className="text-xs text-slate-500 font-mono mb-3 flex items-center gap-1">
                      <MapPin size={12} /> {r.location}
                    </div>
                  )}
                  <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">{r.summary}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
