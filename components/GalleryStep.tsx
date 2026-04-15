'use client';

import { motion } from 'framer-motion';
import {
  Crown,
  AlertTriangle,
  Loader2,
  RefreshCcw,
  EyeOff,
  Eye,
  Users,
  Upload,
} from 'lucide-react';
import { GalleryItem, GalleryType } from '@/types';
import { useGallery } from '@/hooks/useGallery';
import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { normalizeCritiqueText } from '@/lib/critique';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import { aspectRatioToStyleValue, clampAspectRatio, deriveAspectRatio } from '@/lib/aspect-ratio';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

interface GalleryStepProps {
  currentGallery: GalleryType;
  setCurrentGallery: (gallery: GalleryType) => void;
  galleryItems: GalleryItem[];
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}

function extractBase64(dataUrl: string): string {
  return dataUrl.includes(',') ? (dataUrl.split(',')[1] ?? '') : dataUrl;
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('File could not be read.'));
    reader.readAsDataURL(file);
  });
}

async function renderImageToJpegPayload(file: File): Promise<{ base64: string; width: number; height: number }> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image could not be loaded.'));
    el.src = dataUrl;
  });

  const maxSide = 2200;
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  const width = Math.max(1, Math.floor(img.width * ratio));
  const height = Math.max(1, Math.floor(img.height * ratio));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing failed.');

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  return {
    base64: extractBase64(canvas.toDataURL('image/jpeg', 0.82)),
    width,
    height,
  };
}

async function renderPdfFirstPageToJpegPayload(file: File): Promise<{ base64: string; width: number; height: number }> {
  const pdfjs = await import('pdfjs-dist');
  const bytes = await file.arrayBuffer();
  const workerSources = [
    '/pdf.worker.min.mjs',
    `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`,
  ];

  for (const workerSrc of workerSources) {
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        continue;
      }

      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      return {
        base64: extractBase64(canvas.toDataURL('image/jpeg', 0.82)),
        width: canvas.width,
        height: canvas.height,
      };
    } catch {
      // Try the next worker source.
    }
  }

  throw new Error('PDF to JPEG conversion failed.');
}

async function convertShareFileToJpeg(file: File): Promise<{ base64: string; width: number; height: number; mimeType: string }> {
  if (file.type === 'application/pdf') {
    const payload = await renderPdfFirstPageToJpegPayload(file);
    return {
      ...payload,
      mimeType: 'image/jpeg',
    };
  }

  const payload = await renderImageToJpegPayload(file);
  return {
    ...payload,
    mimeType: 'image/jpeg',
  };
}

export function GalleryStep({ currentGallery, setCurrentGallery, galleryItems }: GalleryStepProps) {
  const language = useLanguage();
  const { fetchGallery, loadMore, filterByType, isLoading, hasMore } = useGallery();
  const { user, getJWT } = useAuth();
  const critique = useDrawOrDieStore((s) => s.critique);
  const latestAnalysisKind = useDrawOrDieStore((s) => s.latestAnalysisKind);

  const [mineApprovedIds, setMineApprovedIds] = useState<string[]>([]);
  const [archivedMineItems, setArchivedMineItems] = useState<GalleryItem[]>([]);
  const [isMineLoading, setIsMineLoading] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [manageError, setManageError] = useState<string | null>(null);
  const [communityTitle, setCommunityTitle] = useState('');
  const [communityNote, setCommunityNote] = useState('');
  const [communityFile, setCommunityFile] = useState<File | null>(null);
  const [includeCurrentAnalysis, setIncludeCurrentAnalysis] = useState(true);
  const [isSubmittingCommunity, setIsSubmittingCommunity] = useState(false);
  const [communityMessage, setCommunityMessage] = useState<string | null>(null);
  const [measuredRatios, setMeasuredRatios] = useState<Record<string, number>>({});

  const canManage = Boolean(user) && Boolean(user?.email);
  const canSubmitCommunity = Boolean(user);

  const authedFetch = async (url: string, init?: RequestInit) => {
    const jwt = await getJWT();
    return fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        ...(init?.headers ?? {}),
      },
    });
  };

  const syncMineItems = async (galleryType: GalleryType) => {
    if (!canManage) {
      setMineApprovedIds([]);
      setArchivedMineItems([]);
      return;
    }

    setIsMineLoading(true);
    setManageError(null);

    try {
      const [approvedRes, archivedRes] = await Promise.all([
        authedFetch(`/api/gallery?mine=1&type=${galleryType}&status=approved&limit=100&offset=0`),
        authedFetch(`/api/gallery?mine=1&type=${galleryType}&status=archived&limit=100&offset=0`),
      ]);

      const approvedPayload = approvedRes.ok
        ? (await approvedRes.json()) as { items?: GalleryItem[] }
        : { items: [] };
      const archivedPayload = archivedRes.ok
        ? (await archivedRes.json()) as { items?: GalleryItem[] }
        : { items: [] };

      setMineApprovedIds((approvedPayload.items ?? []).map((item) => item.id));
      setArchivedMineItems(archivedPayload.items ?? []);
    } catch (error) {
      setManageError(
        error instanceof Error
          ? error.message
          : pickLocalized(language, 'Kişisel galeri durumu alınamadı.', 'Could not load personal gallery state.'),
      );
    } finally {
      setIsMineLoading(false);
    }
  };

  useEffect(() => {
    void fetchGallery({ type: currentGallery, refresh: true });
    void syncMineItems(currentGallery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGalleryChange = async (type: GalleryType) => {
    setCurrentGallery(type);
    await filterByType(type);
    await syncMineItems(type);
  };

  const handleVisibilityAction = async (submissionId: string, action: 'ARCHIVE' | 'RESHARE') => {
    if (!canManage) return;

    setMutatingId(submissionId);
    setManageError(null);

    try {
      const res = await authedFetch('/api/gallery', {
        method: 'PATCH',
        body: JSON.stringify({ submissionId, action }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : pickLocalized(language, 'Galeri güncellenemedi.', 'Could not update gallery.'),
        );
      }

      await filterByType(currentGallery);
      await syncMineItems(currentGallery);
    } catch (error) {
      setManageError(
        error instanceof Error
          ? error.message
          : pickLocalized(language, 'Galeri güncellenemedi.', 'Could not update gallery.'),
      );
    } finally {
      setMutatingId(null);
    }
  };

  const handleCommunityFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setCommunityFile(null);
      return;
    }

    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setCommunityMessage(pickLocalized(language, 'Sadece JPG, PNG veya PDF paylaşabilirsin.', 'Only JPG, PNG, or PDF are allowed.'));
      setCommunityFile(null);
      return;
    }

    setCommunityMessage(null);
    setCommunityFile(file);
  };

  const submitCommunityPost = async () => {
    if (!canSubmitCommunity) {
      setCommunityMessage(pickLocalized(language, 'Paylaşım için giriş yapmalısın.', 'Please sign in to share.'));
      return;
    }

    if (!communityFile) {
      setCommunityMessage(pickLocalized(language, 'Paylaşmak için bir pafta veya görsel seç.', 'Choose a board or image to share.'));
      return;
    }

    const normalizedCritique = normalizeCritiqueText(critique ?? '').trim();
    const note = communityNote.trim();
    const juryQuote = includeCurrentAnalysis && normalizedCritique
      ? normalizedCritique.substring(0, 1200)
      : (note || pickLocalized(language, 'Topluluğa açık pafta paylaşımı.', 'A public community board share.'));

    const title = communityTitle.trim() || communityFile.name.replace(/\.[^.]+$/, '').substring(0, 120) || pickLocalized(language, 'Topluluk Paftası', 'Community board');

    setIsSubmittingCommunity(true);
    setCommunityMessage(null);

    try {
      const jpegPayload = await convertShareFileToJpeg(communityFile);
      const aspectRatio = deriveAspectRatio(jpegPayload.width, jpegPayload.height);

      const response = await authedFetch('/api/gallery', {
        method: 'POST',
        body: JSON.stringify({
          title,
          juryQuote,
          galleryType: 'COMMUNITY',
          imageBase64: jpegPayload.base64,
          mimeType: jpegPayload.mimeType,
          analysisKind: latestAnalysisKind ?? 'COMMUNITY_UPLOAD',
          previewWidth: jpegPayload.width,
          previewHeight: jpegPayload.height,
          aspectRatio,
          autoApproved: true,
        }),
      });

      const payload = await response.json().catch(() => ({})) as {
        error?: string;
        moderationPendingReview?: boolean;
        code?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || pickLocalized(language, 'Paylaşım yayınlanamadı.', 'Could not publish the share.'));
      }

      setCommunityFile(null);
      setCommunityTitle('');
      setCommunityNote('');
      if (payload.moderationPendingReview || payload.code === 'COMMUNITY_PENDING_REVIEW') {
        setCommunityMessage(pickLocalized(language, 'Paylaşımın inceleme kuyruğuna alındı. Moderasyon tamamlandığında feedde görünecek.', 'Your share is queued for review. It will appear in the feed after moderation.'));
      } else {
        setCommunityMessage(pickLocalized(language, 'Paylaşım AI kontrolünden geçti ve community feedine eklendi.', 'The share passed AI review and was added to the community feed.'));
      }
      await filterByType('COMMUNITY');
      await syncMineItems('COMMUNITY');
    } catch (error) {
      setCommunityMessage(error instanceof Error ? error.message : pickLocalized(language, 'Paylaşım yayınlanamadı.', 'Could not publish the share.'));
    } finally {
      setIsSubmittingCommunity(false);
    }
  };

  const filteredItems = useMemo(
    () => galleryItems.filter((item) => item.type === currentGallery),
    [galleryItems, currentGallery],
  );

  const getCardAspect = (item: GalleryItem) => {
    const measured = measuredRatios[item.id];
    if (Number.isFinite(measured)) return aspectRatioToStyleValue(measured);
    return aspectRatioToStyleValue(item.aspectRatio);
  };

  return (
    <motion.div
      key="gallery"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-7xl flex flex-col mt-4"
    >
      <div className="flex items-center justify-center flex-wrap gap-2 md:gap-4 mb-10">
        <button
          onClick={() => void handleGalleryChange('COMMUNITY')}
          className={`px-5 py-2.5 font-display font-bold uppercase tracking-wider text-sm transition-colors border-b-2 ${currentGallery === 'COMMUNITY' ? 'text-cyan-300 border-cyan-300' : 'text-slate-500 border-transparent hover:text-white'}`}
        >
          <Users size={18} className="inline mr-2 -mt-1" /> {pickLocalized(language, 'Community', 'Community')}
        </button>
        <button
          onClick={() => void handleGalleryChange('HALL_OF_FAME')}
          className={`px-5 py-2.5 font-display font-bold uppercase tracking-wider text-sm transition-colors border-b-2 ${currentGallery === 'HALL_OF_FAME' ? 'text-emerald-500 border-emerald-500' : 'text-slate-500 border-transparent hover:text-white'}`}
        >
          <Crown size={18} className="inline mr-2 -mt-1" /> {pickLocalized(language, 'Hall of Fame', 'Hall of Fame')}
        </button>
        <button
          onClick={() => void handleGalleryChange('WALL_OF_DEATH')}
          className={`px-5 py-2.5 font-display font-bold uppercase tracking-wider text-sm transition-colors border-b-2 ${currentGallery === 'WALL_OF_DEATH' ? 'text-neon-red border-neon-red' : 'text-slate-500 border-transparent hover:text-white'}`}
        >
          <AlertTriangle size={18} className="inline mr-2 -mt-1" /> {pickLocalized(language, 'Wall of Death', 'Wall of Death')}
        </button>
      </div>

      {currentGallery === 'COMMUNITY' && (
        <div className="mb-8 rounded-xl border border-cyan-400/30 bg-cyan-500/5 p-5">
          <h3 className="text-sm font-mono uppercase tracking-widest text-cyan-200 mb-3">{pickLocalized(language, 'Topluluk Paylaşımı', 'Community sharing')}</h3>
          {!canSubmitCommunity ? (
            <p className="text-sm text-slate-300">{pickLocalized(language, 'Topluluğa pafta paylaşmak için önce giriş yap.', 'Sign in first to share a board with the community.')}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={communityTitle}
                  onChange={(event) => setCommunityTitle(event.target.value)}
                  placeholder={pickLocalized(language, 'Başlık (opsiyonel)', 'Title (optional)')}
                  className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
                />
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={handleCommunityFileChange}
                  className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-slate-300"
                />
              </div>
              <textarea
                value={communityNote}
                onChange={(event) => setCommunityNote(event.target.value)}
                placeholder={pickLocalized(language, 'Paylaşım notu (opsiyonel)', 'Share note (optional)')}
                className="mt-3 min-h-20 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
              />
              <label className="mt-3 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-slate-300">
                <input
                  type="checkbox"
                  checked={includeCurrentAnalysis}
                  onChange={(event) => setIncludeCurrentAnalysis(event.target.checked)}
                  className="accent-cyan-400"
                />
                {pickLocalized(language, 'Varsa mevcut analiz notunu ekle', 'Include the current analysis note if available')}
              </label>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-400">{pickLocalized(language, 'PDF dosyaları ilk sayfa JPEG önizlemeye çevrilerek paylaşılır.', 'PDF files are shared as a first-page JPEG preview.')}</p>
                <button
                  type="button"
                  onClick={() => void submitCommunityPost()}
                  disabled={isSubmittingCommunity}
                  className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-4 py-2 text-xs font-mono uppercase tracking-widest text-cyan-100 hover:bg-cyan-400/20 disabled:opacity-50"
                >
                  {isSubmittingCommunity ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {pickLocalized(language, 'Paylaş', 'Share')}
                </button>
              </div>
            </>
          )}
          {communityMessage && (
            <p className="mt-3 text-xs font-mono text-cyan-100">{communityMessage}</p>
          )}
        </div>
      )}

      {manageError && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-200 text-sm font-mono">
          {manageError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {filteredItems.map((item) => {
          const normalizedJury = normalizeCritiqueText(item.jury) || item.jury;
          const isMineApproved = mineApprovedIds.includes(item.id);

          return (
            <article key={item.id} className="group rounded-xl border border-white/10 bg-black/40 overflow-hidden">
              <div
                className="relative w-full bg-black"
                style={{ aspectRatio: getCardAspect(item) }}
              >
                <img
                  src={item.img}
                  alt={item.title}
                  className="h-full w-full object-contain"
                  onLoad={(event) => {
                    const target = event.currentTarget;
                    const ratio = clampAspectRatio(deriveAspectRatio(target.naturalWidth, target.naturalHeight));
                    setMeasuredRatios((prev) => (prev[item.id] === ratio ? prev : { ...prev, [item.id]: ratio }));
                  }}
                />

                {canManage && isMineApproved && (
                  <button
                    type="button"
                    onClick={() => void handleVisibilityAction(item.id, 'ARCHIVE')}
                    disabled={mutatingId === item.id}
                    className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-lg border border-amber-400/40 bg-black/80 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-amber-200 hover:bg-black disabled:opacity-50"
                  >
                    {mutatingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />}
                    {pickLocalized(language, 'Kaldır', 'Archive')}
                  </button>
                )}
              </div>

              <div className="p-4 bg-gradient-to-b from-black/0 to-black/70">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-display font-bold text-lg text-white line-clamp-1">{item.title}</h3>
                  <span className="rounded border border-white/20 bg-white/5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                    {item.analysisKind || 'SINGLE_JURY'}
                  </span>
                </div>
                <p className={`font-mono text-xs leading-relaxed whitespace-pre-line ${currentGallery === 'HALL_OF_FAME' ? 'text-emerald-300' : currentGallery === 'WALL_OF_DEATH' ? 'text-neon-red' : 'text-cyan-100'}`}>
                  {truncateText(normalizedJury, 560)}
                </p>
              </div>
            </article>
          );
        })}

        {filteredItems.length === 0 && !isLoading && (
          <div className="text-center py-20 text-slate-500 font-mono border border-white/10 rounded-xl bg-white/5 sm:col-span-2 lg:col-span-3 xl:col-span-5">
            {pickLocalized(language, 'Bu feedde henüz gönderi yok.', 'There are no posts in this feed yet.')}
          </div>
        )}
      </div>

      {hasMore && filteredItems.length > 0 && (
        <div className="flex justify-center mt-12">
          <button
            onClick={() => void loadMore()}
            disabled={isLoading}
            className="px-8 py-3 bg-white/5 border border-white/20 text-white font-bold uppercase tracking-wider text-sm hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> {pickLocalized(language, 'Yükleniyor...', 'Loading...')}
              </>
            ) : (
              <>
                <RefreshCcw size={16} /> {pickLocalized(language, 'Daha Fazla Yükle', 'Load more')}
              </>
            )}
          </button>
        </div>
      )}

      {isLoading && filteredItems.length === 0 && (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-slate-500" />
        </div>
      )}

      {canManage && (
        <div className="mt-12 rounded-xl border border-white/10 bg-[#101827] p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-mono text-sm uppercase tracking-widest text-slate-300">
              {pickLocalized(language, 'Kaldırılan Paylaşımların', 'Archived shares')}
            </h3>
            {isMineLoading && (
              <span className="text-xs font-mono text-slate-400 inline-flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> {pickLocalized(language, 'Güncelleniyor', 'Updating')}
              </span>
            )}
          </div>

          {archivedMineItems.length === 0 ? (
            <p className="text-sm text-slate-400 font-mono">{pickLocalized(language, 'Bu feedde kaldırılmış bir paylaşımın yok.', 'You have no archived shares in this feed.')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {archivedMineItems.map((item) => (
                <div key={`archived-${item.id}`} className="rounded-lg border border-white/10 bg-white/5 p-3 flex items-start gap-3">
                  <img src={item.img} alt={item.title} className="w-20 h-24 object-contain rounded border border-white/10 bg-black/40" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display text-white truncate">{item.title}</p>
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-3 whitespace-pre-line">
                      {truncateText(normalizeCritiqueText(item.jury) || item.jury, 180)}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleVisibilityAction(item.id, 'RESHARE')}
                      disabled={mutatingId === item.id}
                      className="mt-2 inline-flex items-center gap-1 rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {mutatingId === item.id ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                      {pickLocalized(language, 'Yeniden Paylaş', 'Reshare')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
