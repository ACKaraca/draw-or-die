'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock3, Loader2, AlertTriangle, Trophy, Skull, ExternalLink, Trash2 } from 'lucide-react';
import type { AnalysisHistoryItem, GalleryPlacementType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import { normalizeCritiqueText } from '@/lib/critique';
import { aspectRatioToStyleValue, clampAspectRatio, deriveAspectRatio } from '@/lib/aspect-ratio';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

const PAGE_SIZE = 12;

function getAnalysisKindLabel(kind: string, language: ReturnType<typeof useLanguage>): string {
  switch (kind) {
    case 'SINGLE_JURY': return pickLocalized(language, 'Tek Jüri', 'Single jury');
    case 'REVISION_SAME': return pickLocalized(language, 'Revizyon', 'Revision');
    case 'MULTI_JURY': return pickLocalized(language, 'Çoklu Jüri', 'Multi jury');
    case 'PREMIUM_RESCUE': return pickLocalized(language, 'Premium Rescue', 'Premium rescue');
    case 'AUTO_CONCEPT': return pickLocalized(language, 'Konsept Üretimi', 'Concept generation');
    case 'MATERIAL_BOARD': return pickLocalized(language, 'Malzeme Paftası', 'Material board');
    default: return kind.replace(/_/g, ' ');
  }
}

function parseMultiHistoryCritique(raw: string) {
  try {
    const parsed = JSON.parse(raw) as {
      mode?: string;
      projectTitle?: string;
      personas?: Array<{ id?: string; name?: string; critique?: string; score?: number }>;
    };

    if (!Array.isArray(parsed.personas)) return null;

    const personas = parsed.personas
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const id = typeof entry.id === 'string' ? entry.id : '';
        const name = typeof entry.name === 'string' ? entry.name : id;
        const critique = typeof entry.critique === 'string' ? entry.critique : '';
        const score = typeof entry.score === 'number' ? entry.score : 0;
        if (!id || !name || !critique) return null;
        return { id, name, critique, score };
      })
      .filter((entry): entry is { id: string; name: string; critique: string; score: number } => Boolean(entry));

    if (personas.length === 0) return null;
    return {
      personas,
      projectTitle:
        typeof parsed.projectTitle === 'string' && parsed.projectTitle.trim()
          ? parsed.projectTitle.trim()
          : undefined,
    };
  } catch {
    // Invalid JSON payloads should be sanitized at source.
  }

  return null;
}

function formatPersonaDisplayName(name: string, index: number): string {
  const cleaned = name.trim();
  return cleaned || `Jüri ${index + 1}`;
}

function renderHistoryPreview(item: AnalysisHistoryItem) {
  if (item.analysisKind === 'MULTI_JURY') {
    const parsed = parseMultiHistoryCritique(item.critique);
    if (parsed) {
      return (
        <div className="space-y-2">
          {parsed.personas.map((persona, index) => (
            <div key={`${item.id}-${persona.id}`} className="rounded-md border border-white/10 bg-white/5 p-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-cyan-200">{formatPersonaDisplayName(persona.name, index)}</p>
              <p className="mt-1 text-xs text-slate-300 line-clamp-3 whitespace-pre-line">{normalizeCritiqueText(persona.critique)}</p>
            </div>
          ))}
        </div>
      );
    }
  }

  return <p className="text-sm text-slate-300 line-clamp-5 whitespace-pre-line">{toHistoryExcerpt(item)}</p>;
}

function toHistoryExcerpt(item: AnalysisHistoryItem): string {
  if (item.analysisKind === 'MULTI_JURY') {
    const parsed = parseMultiHistoryCritique(item.critique);
    if (parsed) {
      return normalizeCritiqueText(
        parsed.personas
          .map((entry, index) => `${formatPersonaDisplayName(entry.name, index)}\n\n${entry.critique}`)
          .join('\n\n---\n\n')
      );
    }
  }

  return normalizeCritiqueText(item.critique);
}

export function HistoryStep() {
  const language = useLanguage();
  const { getJWT } = useAuth();
  const [items, setItems] = useState<AnalysisHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<GalleryPlacementType | 'ALL'>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [measuredRatios, setMeasuredRatios] = useState<Record<string, number>>({});
  const {
    setStep,
    setCritique,
    setGalleryPlacement,
    setGalleryConsent,
    setPreviewUrl,
    setMimeType,
    setPreviousProject,
    setLastProgression,
    setPremiumData,
    setMultiData,
    setIsRevisionMode,
    setSelectedFlawIndex,
    setIsDefending,
    setDefenseMessages,
    setDefenseTurnCount,
    setDefenseInput,
    addToast,
  } = useDrawOrDieStore();

  const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
    const jwt = await getJWT();

    const mergedHeaders: HeadersInit = {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${jwt}`,
    };

    return fetch(url, {
      ...init,
      headers: {
        ...mergedHeaders,
      },
    });
  }, [getJWT]);

  const fetchHistory = useCallback(async (nextOffset = 0, reset = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(nextOffset),
      });

      const res = await authedFetch(`/api/analysis-history?${params.toString()}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(typeof payload?.error === 'string' ? payload.error : pickLocalized(language, 'Geçmiş yüklenemedi.', 'Could not load history.'));
      }

      const payload = (await res.json()) as {
        items?: AnalysisHistoryItem[];
        total?: number;
      };

      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      const nextTotal = typeof payload.total === 'number' ? payload.total : 0;

      if (reset) {
        setItems(nextItems);
      } else {
        setItems((prev) => [...prev, ...nextItems]);
      }
      setTotal(nextTotal);
      setOffset(nextOffset + PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : pickLocalized(language, 'Geçmiş yüklenemedi.', 'Could not load history.'));
    } finally {
      setIsLoading(false);
    }
  }, [authedFetch, language]);

  useEffect(() => {
    void fetchHistory(0, true);
  }, [fetchHistory]);

  const visibleItems = useMemo(() => {
    if (filter === 'ALL') return items;
    return items.filter((item) => item.galleryType === filter);
  }, [filter, items]);

  const hasMore = items.length < total;

  const openHistoryAnalysis = (item: AnalysisHistoryItem) => {
    if (item.isDeleted) return;
    const parsedMulti = item.analysisKind === 'MULTI_JURY' ? parseMultiHistoryCritique(item.critique) : null;
    const normalizedCritique = toHistoryExcerpt(item);
    if (!normalizedCritique && !parsedMulti) return;

    setPreviewUrl(item.sourceUrl || item.previewUrl);
    setMimeType(item.sourceMime || 'image/webp');
    setPreviousProject(null);
    setLastProgression(null);
    setPremiumData(null);
    setMultiData(null);
    setIsRevisionMode(false);
    setSelectedFlawIndex(null);
    setIsDefending(false);
    setDefenseMessages([]);
    setDefenseTurnCount(0);
    setDefenseInput('');
    setGalleryPlacement(item.galleryType);
    setGalleryConsent(item.galleryType === 'NONE' ? null : true);

    if (parsedMulti) {
      setMultiData(parsedMulti);
      setCritique(null);
      setStep('multi-result');
      return;
    }

    setMultiData(null);
    setCritique(normalizedCritique);
    setStep('result');
  };

  const deleteHistoryItem = useCallback(async (item: AnalysisHistoryItem) => {
    if (item.isDeleted) return;

    setDeletingId(item.id);
    try {
      const response = await authedFetch('/api/analysis-history', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ historyId: item.id }),
      });

      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        item?: { deletedAt?: string; purgeAfter?: string };
      };

      if (!response.ok) {
        throw new Error(payload.error || pickLocalized(language, 'Analiz silinemedi.', 'Could not delete analysis.'));
      }

      setItems((prev) => prev.map((entry) =>
        entry.id === item.id
          ? {
            ...entry,
            isDeleted: true,
            deletedAt: payload.item?.deletedAt ?? new Date().toISOString(),
            purgeAfter: payload.item?.purgeAfter ?? null,
          }
          : entry,
      ));

      addToast(pickLocalized(language, 'Analiz ve proje silindi olarak işaretlendi. 30 gün sonra kalıcı silinecek.', 'Analysis and project marked deleted. They will be permanently removed after 30 days.'), 'success');
    } catch (deleteError) {
      addToast(deleteError instanceof Error ? deleteError.message : pickLocalized(language, 'Analiz silinemedi.', 'Could not delete analysis.'), 'error');
    } finally {
      setDeletingId(null);
    }
  }, [
    addToast,
    authedFetch,
  ]);

  return (
    <motion.div
      key="history"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-7xl flex flex-col mt-4"
    >
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="font-display text-3xl font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Clock3 className="text-cyan-400" /> {pickLocalized(language, 'Analiz Geçmişi', 'Analysis history')}
          </h2>
          <p className="text-slate-400 text-sm mt-1">{pickLocalized(language, 'Önceki jüri raporlarını ve puanlarını buradan inceleyebilirsin.', 'Review previous jury reports and scores here.')}</p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-2 border rounded ${filter === 'ALL' ? 'border-cyan-400 text-cyan-300 bg-cyan-500/10' : 'border-white/20 text-slate-300 hover:text-white'}`}
          >
            {pickLocalized(language, 'Tümü', 'All')}
          </button>
          <button
            onClick={() => setFilter('HALL_OF_FAME')}
            className={`px-3 py-2 border rounded ${filter === 'HALL_OF_FAME' ? 'border-emerald-400 text-emerald-300 bg-emerald-500/10' : 'border-white/20 text-slate-300 hover:text-white'}`}
          >
            {pickLocalized(language, 'Hall', 'Hall')}
          </button>
          <button
            onClick={() => setFilter('WALL_OF_DEATH')}
            className={`px-3 py-2 border rounded ${filter === 'WALL_OF_DEATH' ? 'border-red-400 text-red-300 bg-red-500/10' : 'border-white/20 text-slate-300 hover:text-white'}`}
          >
            {pickLocalized(language, 'Wall', 'Wall')}
          </button>
          <button
            onClick={() => setFilter('NONE')}
            className={`px-3 py-2 border rounded ${filter === 'NONE' ? 'border-slate-400 text-slate-200 bg-slate-500/10' : 'border-white/20 text-slate-300 hover:text-white'}`}
          >
            {pickLocalized(language, 'Galeri Dışı', 'Outside gallery')}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200 text-sm font-mono">
          {error}
        </div>
      )}

      <div className="columns-1 md:columns-2 xl:columns-3 gap-6 [column-fill:_balance]">
        {visibleItems.map((item) => (
          <article key={item.id} className={`mb-6 break-inside-avoid bg-[#111827] border rounded-xl overflow-hidden ${item.isDeleted ? 'border-red-500/30 opacity-80' : 'border-white/10'}`}>
            <div className="bg-black/40 overflow-hidden" style={{ aspectRatio: aspectRatioToStyleValue(measuredRatios[item.id] ?? item.aspectRatio) }}>
              <img
                src={item.previewUrl}
                alt={item.title}
                className="w-full h-full object-contain bg-black/50"
                onLoad={(event) => {
                  const ratio = clampAspectRatio(deriveAspectRatio(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight));
                  setMeasuredRatios((prev) => (prev[item.id] === ratio ? prev : { ...prev, [item.id]: ratio }));
                }}
              />
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="font-display text-lg font-bold text-white leading-tight line-clamp-1">{item.title}</h3>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                    {getAnalysisKindLabel(item.analysisKind, language)}
                  </span>
                  {item.galleryType === 'HALL_OF_FAME' && <Trophy size={16} className="text-emerald-400" />}
                  {item.galleryType === 'WALL_OF_DEATH' && <Skull size={16} className="text-red-400" />}
                </div>
              </div>
              <p className="text-xs text-slate-400 mb-3 font-mono">{new Date(item.createdAt).toLocaleString(language === 'en' ? 'en-US' : 'tr-TR')}</p>
              {renderHistoryPreview(item)}
              <div className="mt-4 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">{pickLocalized(language, 'Puan', 'Score')}</span>
                <span className="text-white font-bold">{typeof item.score === 'number' ? item.score : '-'}</span>
              </div>
              <button
                type="button"
                onClick={() => openHistoryAnalysis(item)}
                disabled={item.isDeleted}
                className="mt-4 w-full rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-cyan-100 text-xs font-mono uppercase tracking-wider hover:bg-cyan-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <ExternalLink size={13} /> {pickLocalized(language, 'Analizi Aç', 'Open analysis')}
              </button>
              <button
                type="button"
                onClick={() => void deleteHistoryItem(item)}
                disabled={deletingId === item.id || item.isDeleted}
                className="mt-2 w-full rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-red-100 text-xs font-mono uppercase tracking-wider hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={13} />
                {item.isDeleted ? pickLocalized(language, 'Silindi (30 gün içinde kalıcı silinecek)', 'Deleted (permanently removed within 30 days)') : (deletingId === item.id ? pickLocalized(language, 'Siliniyor...', 'Deleting...') : pickLocalized(language, 'Analizi ve Projeyi Sil', 'Delete analysis and project'))}
              </button>
              {item.isDeleted && (
                <p className="mt-2 text-[11px] text-red-200 font-mono">
                  {pickLocalized(language, 'Analiz ve proje silindi olarak işaretlendi.', 'Analysis and project marked deleted.')}
                  {item.purgeAfter ? ` ${pickLocalized(language, 'Kalıcı silinme:', 'Permanent removal:')} ${new Date(item.purgeAfter).toLocaleString(language === 'en' ? 'en-US' : 'tr-TR')}` : ''}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>

      {!isLoading && visibleItems.length === 0 && !error && (
        <div className="col-span-full text-center py-16 text-slate-500 font-mono border border-white/10 rounded-xl mt-4">
          <AlertTriangle className="mx-auto mb-3" />
          {pickLocalized(language, 'Henüz kayıtlı analiz geçmişi bulunamadı.', 'No saved analysis history yet.')}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center mt-10">
          <button
            onClick={() => void fetchHistory(offset)}
            disabled={isLoading}
            className="px-8 py-3 bg-white/5 border border-white/20 text-white font-bold uppercase tracking-wider text-sm hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> {pickLocalized(language, 'Yükleniyor...', 'Loading...')}
              </>
            ) : (
              pickLocalized(language, 'Daha Fazla Geçmiş', 'Load more history')
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}
