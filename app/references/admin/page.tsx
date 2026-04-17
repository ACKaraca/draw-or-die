'use client';

import { useState } from 'react';
import Link from 'next/link';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

export default function ReferencesAdminPage() {
  const language = useLanguage();
  const { user, loading: isLoading } = useAuth();
  const [form, setForm] = useState({
    title: '',
    architect: '',
    year: '',
    location: '',
    typology: '',
    summary: '',
    analysisMd: '',
    coverImageUrl: '',
    planImageUrls: '',
    sectionImageUrls: '',
    tags: '',
    slug: '',
    isPublished: true,
  });
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; message?: string }>({ kind: 'idle' });

  const update = <K extends keyof typeof form>(key: K, val: typeof form[K]) => setForm((prev) => ({ ...prev, [key]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus({ kind: 'idle' });
    try {
      const jwt = await account.createJWT();
      const payload = {
        title: form.title,
        architect: form.architect,
        year: form.year ? Number(form.year) : undefined,
        location: form.location,
        typology: form.typology,
        summary: form.summary,
        analysisMd: form.analysisMd,
        coverImageUrl: form.coverImageUrl,
        planImageUrls: form.planImageUrls.split('\n').map((s) => s.trim()).filter(Boolean),
        sectionImageUrls: form.sectionImageUrls.split('\n').map((s) => s.trim()).filter(Boolean),
        tags: form.tags.split(',').map((s) => s.trim()).filter(Boolean),
        slug: form.slug || undefined,
        isPublished: form.isPublished,
      };
      const res = await fetch('/api/references', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt.jwt}`,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      setStatus({ kind: 'ok', message: pickLocalized(language, `Eklendi: ${body.reference.slug}`, `Added: ${body.reference.slug}`) });
      setForm({
        title: '', architect: '', year: '', location: '', typology: '',
        summary: '', analysisMd: '', coverImageUrl: '', planImageUrls: '',
        sectionImageUrls: '', tags: '', slug: '', isPublished: true,
      });
    } catch (err) {
      setStatus({ kind: 'err', message: err instanceof Error ? err.message : 'Error' });
    }
  };

  if (isLoading) return <main className="min-h-screen bg-black text-white p-10">Loading...</main>;
  if (!user) return <main className="min-h-screen bg-black text-white p-10">{pickLocalized(language, 'Giriş gerekli.', 'Sign-in required.')}</main>;

  const inputCls = 'w-full bg-[#111827] border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-amber-400/50';
  const labelCls = 'block text-xs uppercase tracking-widest font-mono text-slate-400 mb-1';

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/references" className="text-slate-400 text-xs font-mono uppercase tracking-widest hover:text-white">
          ← {pickLocalized(language, 'Kütüphane', 'Library')}
        </Link>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wider mt-4 mb-8">
          {pickLocalized(language, 'Referans Ekle (Admin)', 'Add Reference (Admin)')}
        </h1>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Title *</label>
              <input className={inputCls} value={form.title} onChange={(e) => update('title', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Architect *</label>
              <input className={inputCls} value={form.architect} onChange={(e) => update('architect', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Year</label>
              <input className={inputCls} type="number" value={form.year} onChange={(e) => update('year', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Typology</label>
              <input className={inputCls} value={form.typology} onChange={(e) => update('typology', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Location</label>
              <input className={inputCls} value={form.location} onChange={(e) => update('location', e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Slug (optional)</label>
              <input className={inputCls} value={form.slug} onChange={(e) => update('slug', e.target.value)} placeholder="peter-zumthor-therme-vals" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Summary *</label>
            <textarea className={`${inputCls} min-h-[80px]`} value={form.summary} onChange={(e) => update('summary', e.target.value)} required />
          </div>

          <div>
            <label className={labelCls}>Analysis (Markdown) *</label>
            <textarea className={`${inputCls} min-h-[240px] font-mono text-sm`} value={form.analysisMd} onChange={(e) => update('analysisMd', e.target.value)} required />
          </div>

          <div>
            <label className={labelCls}>Cover Image URL</label>
            <input className={inputCls} value={form.coverImageUrl} onChange={(e) => update('coverImageUrl', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Plan Image URLs (one per line)</label>
            <textarea className={`${inputCls} min-h-[80px] font-mono text-xs`} value={form.planImageUrls} onChange={(e) => update('planImageUrls', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Section Image URLs (one per line)</label>
            <textarea className={`${inputCls} min-h-[80px] font-mono text-xs`} value={form.sectionImageUrls} onChange={(e) => update('sectionImageUrls', e.target.value)} />
          </div>

          <div>
            <label className={labelCls}>Tags (comma-separated)</label>
            <input className={inputCls} value={form.tags} onChange={(e) => update('tags', e.target.value)} placeholder="thermal, phenomenology, stone" />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => update('isPublished', e.target.checked)} />
            {pickLocalized(language, 'Yayında', 'Published')}
          </label>

          {status.kind === 'ok' && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded p-3 text-sm">{status.message}</div>}
          {status.kind === 'err' && <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded p-3 text-sm">{status.message}</div>}

          <button type="submit" className="bg-amber-400 hover:bg-amber-300 text-black font-bold uppercase tracking-wider px-6 py-3 rounded">
            {pickLocalized(language, 'Kaydet', 'Save')}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500 font-mono">
          {pickLocalized(
            language,
            'Not: Yalnızca ADMIN_EMAILS env değişkeninde yer alan e-postalar bu endpoint\'i kullanabilir.',
            'Note: only emails listed in the ADMIN_EMAILS env var can use this endpoint.',
          )}
        </p>
      </div>
    </main>
  );
}
