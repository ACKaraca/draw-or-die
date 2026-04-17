'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Square,
  Type,
  X,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LayoutElement {
  id: string;
  type: 'image' | 'text' | 'shape';
  x: number;
  y: number;
  w: number;
  h: number;
  // text
  content?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  // image
  imageUrl?: string;
  objectFit?: 'cover' | 'contain';
  // shape
  backgroundColor?: string;
  borderRadius?: number;
  opacity?: number;
}

interface PageLayout {
  background: string;
  elements: LayoutElement[];
}

interface PortfolioSummary {
  id: string;
  title: string;
  subtitle?: string;
  pageCount: number;
  isPublic: boolean;
  shareSlug?: string;
  coverUrl?: string;
}

interface PortfolioPage {
  id: string;
  portfolioId: string;
  pageIndex: number;
  planJson: string;
  layoutJson: string;
}

type ResizeHandle =
  | 'nw' | 'n' | 'ne'
  | 'w'         | 'e'
  | 'sw' | 's' | 'se';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultLayout(): PageLayout {
  return { background: '#ffffff', elements: [] };
}

function parseLayout(raw: string): PageLayout {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.elements)) return parsed as PageLayout;
  } catch {
    // fall through
  }
  return defaultLayout();
}

// ---------------------------------------------------------------------------
// CanvasEditor
// ---------------------------------------------------------------------------

interface CanvasEditorProps {
  pageId: string;
  portfolioId: string;
  initialLayout: PageLayout;
  onSave?: (layout: PageLayout) => void;
  getJWT: () => Promise<string>;
  onRapidoUpdate?: (newBalance: number) => void;
}

function CanvasEditor({ pageId, portfolioId, initialLayout, onSave, getJWT }: CanvasEditorProps) {
  const language = useLanguage();

  const [layout, setLayout] = useState<PageLayout>(() => ({
    background: initialLayout.background,
    elements: initialLayout.elements.map((el) => ({ ...el })),
  }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Drag state
  const draggingRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  // Resize state
  const resizingRef = useRef<{
    id: string;
    handle: ResizeHandle;
    startX: number; startY: number;
    origX: number; origY: number;
    origW: number; origH: number;
    canvasW: number; canvasH: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedEl = layout.elements.find((el) => el.id === selectedId) ?? null;

  // ------ Mouse move / up on canvas ------
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    if (draggingRef.current) {
      const { id, offsetX, offsetY } = draggingRef.current;
      const rawX = ((e.clientX - rect.left - offsetX) / rect.width) * 100;
      const rawY = ((e.clientY - rect.top - offsetY) / rect.height) * 100;

      setLayout((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === id
            ? {
                ...el,
                x: Math.max(0, Math.min(100 - el.w, rawX)),
                y: Math.max(0, Math.min(100 - el.h, rawY)),
              }
            : el
        ),
      }));
      return;
    }

    if (resizingRef.current) {
      const r = resizingRef.current;
      const dx = ((e.clientX - r.startX) / rect.width) * 100;
      const dy = ((e.clientY - r.startY) / rect.height) * 100;
      const h = r.handle;

      let nx = r.origX;
      let ny = r.origY;
      let nw = r.origW;
      let nh = r.origH;

      if (h.includes('e')) nw = Math.max(5, r.origW + dx);
      if (h.includes('s')) nh = Math.max(5, r.origH + dy);
      if (h.includes('w')) {
        nw = Math.max(5, r.origW - dx);
        nx = r.origX + dx;
      }
      if (h.includes('n')) {
        nh = Math.max(5, r.origH - dy);
        ny = r.origY + dy;
      }

      setLayout((prev) => ({
        ...prev,
        elements: prev.elements.map((el) =>
          el.id === r.id ? { ...el, x: nx, y: ny, w: nw, h: nh } : el
        ),
      }));
    }
  }, []);

  const handleCanvasMouseUp = useCallback(() => {
    draggingRef.current = null;
    resizingRef.current = null;
  }, []);

  useEffect(() => {
    const up = () => {
      draggingRef.current = null;
      resizingRef.current = null;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  // ------ Element mouse down (start drag) ------
  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setSelectedId(id);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const el = layout.elements.find((x) => x.id === id);
      if (!el) return;
      const elPxX = (el.x / 100) * rect.width;
      const elPxY = (el.y / 100) * rect.height;
      draggingRef.current = {
        id,
        offsetX: e.clientX - rect.left - elPxX,
        offsetY: e.clientY - rect.top - elPxY,
      };
    },
    [layout.elements]
  );

  // ------ Resize handle mouse down ------
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, id: string, handle: ResizeHandle) => {
      e.stopPropagation();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const el = layout.elements.find((x) => x.id === id);
      if (!el) return;
      resizingRef.current = {
        id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origX: el.x,
        origY: el.y,
        origW: el.w,
        origH: el.h,
        canvasW: rect.width,
        canvasH: rect.height,
      };
    },
    [layout.elements]
  );

  // ------ Toolbar actions ------
  const addText = useCallback(() => {
    const el: LayoutElement = {
      id: uid(),
      type: 'text',
      x: 10, y: 10, w: 40, h: 10,
      content: 'Metin',
      fontSize: 16,
      fontWeight: 'normal',
      color: '#111827',
      textAlign: 'left',
    };
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }, []);

  const addShape = useCallback(() => {
    const el: LayoutElement = {
      id: uid(),
      type: 'shape',
      x: 20, y: 20, w: 30, h: 20,
      backgroundColor: '#f59e0b',
      borderRadius: 0,
      opacity: 1,
    };
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }));
    setSelectedId(el.id);
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setLayout((prev) => ({ ...prev, elements: prev.elements.filter((el) => el.id !== selectedId) }));
    setSelectedId(null);
  }, [selectedId]);

  const updateSelected = useCallback((patch: Partial<LayoutElement>) => {
    if (!selectedId) return;
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)),
    }));
  }, [selectedId]);

  // ------ Save ------
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const jwt = await getJWT();
      await fetch(`/api/portfolio/${portfolioId}/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ layoutJson: JSON.stringify(layout) }),
      });
      onSave?.(layout);
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [getJWT, portfolioId, pageId, layout, onSave]);

  // ------ Download PNG ------
  const handleDownload = useCallback(async () => {
    if (!canvasRef.current) return;
    setDownloading(true);
    try {
      const cvs = await html2canvas(canvasRef.current, { scale: 2, useCORS: true });
      const url = cvs.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio-page-${pageId}.png`;
      a.click();
    } catch {
      // silent
    } finally {
      setDownloading(false);
    }
  }, [pageId]);

  // ------ Resize handle positions ------
  const HANDLE_POSITIONS: Array<{ handle: ResizeHandle; style: React.CSSProperties }> = [
    { handle: 'nw', style: { top: -4, left: -4, cursor: 'nw-resize' } },
    { handle: 'n',  style: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' } },
    { handle: 'ne', style: { top: -4, right: -4, cursor: 'ne-resize' } },
    { handle: 'w',  style: { top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'w-resize' } },
    { handle: 'e',  style: { top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'e-resize' } },
    { handle: 'sw', style: { bottom: -4, left: -4, cursor: 'sw-resize' } },
    { handle: 's',  style: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' } },
    { handle: 'se', style: { bottom: -4, right: -4, cursor: 'se-resize' } },
  ];

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-[#111827] border border-white/10 rounded-xl">
        <button
          onClick={addText}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white font-mono text-xs uppercase tracking-widest transition-colors"
        >
          <Type size={13} />
          {pickLocalized(language, 'Metin Ekle', 'Add Text')}
        </button>
        <button
          onClick={addShape}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white font-mono text-xs uppercase tracking-widest transition-colors"
        >
          <Square size={13} />
          {pickLocalized(language, 'Şekil Ekle', 'Add Shape')}
        </button>
        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white font-mono text-xs uppercase tracking-widest cursor-pointer transition-colors">
          <span className="w-4 h-4 rounded-sm border border-white/20" style={{ backgroundColor: layout.background }} />
          {pickLocalized(language, 'Arkaplan', 'Background')}
          <input
            type="color"
            value={layout.background}
            onChange={(e) => setLayout((prev) => ({ ...prev, background: e.target.value }))}
            className="sr-only"
          />
        </label>
        <div className="flex-1" />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 rounded text-white font-mono text-xs uppercase tracking-widest transition-colors"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {saveToast
            ? pickLocalized(language, 'Kaydedildi ✓', 'Saved ✓')
            : pickLocalized(language, 'Kaydet', 'Save')}
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-white/5 hover:bg-white/10 border border-emerald-400/30 rounded text-emerald-400 font-mono text-xs uppercase tracking-widest transition-colors"
        >
          {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          {pickLocalized(language, 'PNG İndir', 'Download PNG')}
        </button>
      </div>

      {/* Editor row */}
      <div className="flex gap-4 items-start">
        {/* A4 Canvas — aspect ratio 1:1.414 */}
        <div className="flex-1 min-w-0">
          <div className="relative w-full" style={{ paddingBottom: '141.4%' }}>
            <div
              ref={canvasRef}
              className="absolute inset-0 overflow-hidden select-none"
              style={{ backgroundColor: layout.background }}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onClick={() => setSelectedId(null)}
            >
              {layout.elements.map((el) => {
                const isSelected = el.id === selectedId;
                return (
                  <div
                    key={el.id}
                    style={{
                      position: 'absolute',
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      width: `${el.w}%`,
                      height: `${el.h}%`,
                      cursor: 'move',
                      outline: isSelected ? '2px solid #f59e0b' : 'none',
                      outlineOffset: '1px',
                      boxSizing: 'border-box',
                    }}
                    onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                  >
                    {/* Element content */}
                    {el.type === 'text' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          fontSize: el.fontSize ?? 16,
                          fontWeight: el.fontWeight ?? 'normal',
                          color: el.color ?? '#111827',
                          textAlign: el.textAlign ?? 'left',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                          lineHeight: 1.3,
                        }}
                      >
                        {el.content ?? ''}
                      </div>
                    )}
                    {el.type === 'image' && (
                      <img
                        src={el.imageUrl ?? ''}
                        alt=""
                        draggable={false}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: el.objectFit ?? 'cover',
                          display: 'block',
                        }}
                      />
                    )}
                    {el.type === 'shape' && (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: el.backgroundColor ?? '#f59e0b',
                          borderRadius: `${el.borderRadius ?? 0}%`,
                          opacity: el.opacity ?? 1,
                        }}
                      />
                    )}

                    {/* Resize handles */}
                    {isSelected &&
                      HANDLE_POSITIONS.map(({ handle, style }) => (
                        <div
                          key={handle}
                          style={{
                            position: 'absolute',
                            width: 8,
                            height: 8,
                            backgroundColor: '#f59e0b',
                            border: '1px solid #92400e',
                            ...style,
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeMouseDown(e, el.id, handle);
                          }}
                        />
                      ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right sidebar — properties */}
        <div className="w-64 shrink-0 flex flex-col gap-3 bg-[#111827] border border-white/10 rounded-xl p-4">
          {!selectedEl ? (
            <p className="font-mono text-xs text-slate-500 uppercase tracking-widest text-center py-4">
              {pickLocalized(language, 'Öğe seçin', 'Select an element')}
            </p>
          ) : (
            <>
              {/* Type badge */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-amber-400">
                  {selectedEl.type}
                </span>
                <button
                  onClick={deleteSelected}
                  className="flex items-center gap-1 px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-red-400 font-mono text-xs transition-colors"
                >
                  <X size={11} />
                  {pickLocalized(language, 'Sil', 'Delete')}
                </button>
              </div>

              {/* Position & Size */}
              <div className="grid grid-cols-2 gap-2">
                {(['x', 'y', 'w', 'h'] as const).map((key) => (
                  <label key={key} className="flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] text-slate-500 uppercase">{key}</span>
                    <input
                      type="number"
                      value={Math.round(selectedEl[key] as number)}
                      onChange={(e) => updateSelected({ [key]: Number(e.target.value) })}
                      className="w-full px-2 py-1 bg-black/50 border border-white/10 rounded text-white text-xs font-mono focus:outline-none focus:border-amber-400/50"
                    />
                  </label>
                ))}
              </div>

              {/* Text props */}
              {selectedEl.type === 'text' && (
                <>
                  <label className="flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] text-slate-500 uppercase">
                      {pickLocalized(language, 'İçerik', 'Content')}
                    </span>
                    <textarea
                      value={selectedEl.content ?? ''}
                      onChange={(e) => updateSelected({ content: e.target.value })}
                      rows={3}
                      className="w-full px-2 py-1 bg-black/50 border border-white/10 rounded text-white text-xs font-mono resize-none focus:outline-none focus:border-amber-400/50"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] text-slate-500 uppercase">
                      {pickLocalized(language, 'Yazı Boyutu', 'Font Size')} ({selectedEl.fontSize ?? 16}px)
                    </span>
                    <input
                      type="range"
                      min={8} max={72}
                      value={selectedEl.fontSize ?? 16}
                      onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })}
                      className="w-full accent-amber-400"
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateSelected({ fontWeight: selectedEl.fontWeight === 'bold' ? 'normal' : 'bold' })}
                      className={`px-2 py-1 rounded border font-mono text-xs transition-colors ${selectedEl.fontWeight === 'bold' ? 'bg-amber-400/20 border-amber-400/50 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}
                    >
                      B
                    </button>
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        onClick={() => updateSelected({ textAlign: align })}
                        className={`px-2 py-1 rounded border font-mono text-xs transition-colors ${selectedEl.textAlign === align ? 'bg-amber-400/20 border-amber-400/50 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}
                      >
                        {align[0].toUpperCase()}
                      </button>
                    ))}
                    <label className="flex items-center gap-1 cursor-pointer">
                      <span className="font-mono text-[10px] text-slate-500 uppercase">
                        {pickLocalized(language, 'Renk', 'Color')}
                      </span>
                      <span className="w-5 h-5 rounded border border-white/20" style={{ backgroundColor: selectedEl.color ?? '#111827' }} />
                      <input
                        type="color"
                        value={selectedEl.color ?? '#111827'}
                        onChange={(e) => updateSelected({ color: e.target.value })}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </>
              )}

              {/* Image props */}
              {selectedEl.type === 'image' && (
                <>
                  <label className="flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] text-slate-500 uppercase">
                      {pickLocalized(language, 'Görsel URL', 'Image URL')}
                    </span>
                    <input
                      type="text"
                      value={selectedEl.imageUrl ?? ''}
                      onChange={(e) => updateSelected({ imageUrl: e.target.value })}
                      className="w-full px-2 py-1 bg-black/50 border border-white/10 rounded text-white text-xs font-mono focus:outline-none focus:border-amber-400/50"
                    />
                  </label>
                  <div className="flex gap-2">
                    {(['cover', 'contain'] as const).map((fit) => (
                      <button
                        key={fit}
                        onClick={() => updateSelected({ objectFit: fit })}
                        className={`flex-1 py-1 rounded border font-mono text-xs transition-colors ${selectedEl.objectFit === fit ? 'bg-amber-400/20 border-amber-400/50 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'}`}
                      >
                        {fit}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Shape props */}
              {selectedEl.type === 'shape' && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="font-mono text-[10px] text-slate-500 uppercase">
                      {pickLocalized(language, 'Renk', 'Color')}
                    </span>
                    <span className="w-5 h-5 rounded border border-white/20" style={{ backgroundColor: selectedEl.backgroundColor ?? '#f59e0b' }} />
                    <input
                      type="color"
                      value={selectedEl.backgroundColor ?? '#f59e0b'}
                      onChange={(e) => updateSelected({ backgroundColor: e.target.value })}
                      className="sr-only"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] text-slate-500 uppercase">
                      {pickLocalized(language, 'Köşe Yuvarlama', 'Border Radius')} ({selectedEl.borderRadius ?? 0})
                    </span>
                    <input
                      type="range"
                      min={0} max={50}
                      value={selectedEl.borderRadius ?? 0}
                      onChange={(e) => updateSelected({ borderRadius: Number(e.target.value) })}
                      className="w-full accent-amber-400"
                    />
                  </label>
                  <label className="flex flex-col gap-0.5">
                    <span className="font-mono text-[10px] text-slate-500 uppercase">
                      {pickLocalized(language, 'Opaklık', 'Opacity')} ({(selectedEl.opacity ?? 1).toFixed(1)})
                    </span>
                    <input
                      type="range"
                      min={0.1} max={1} step={0.05}
                      value={selectedEl.opacity ?? 1}
                      onChange={(e) => updateSelected({ opacity: Number(e.target.value) })}
                      className="w-full accent-amber-400"
                    />
                  </label>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddPageDrawer
// ---------------------------------------------------------------------------

interface AddPageDrawerProps {
  portfolioId: string;
  rapidoBalance: number;
  getJWT: () => Promise<string>;
  onCreated: (page: PortfolioPage, remainingRapido: number) => void;
  onClose: () => void;
}

function AddPageDrawer({ portfolioId, rapidoBalance, getJWT, onCreated, onClose }: AddPageDrawerProps) {
  const language = useLanguage();
  const [imageUrlsText, setImageUrlsText] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'warm'>('light');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    const imageUrls = imageUrlsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);

    setError('');
    setLoading(true);
    try {
      const jwt = await getJWT();
      const res = await fetch(`/api/portfolio/${portfolioId}/pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ imageUrls, theme }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Failed');
      }
      const data = await res.json() as { page: PortfolioPage; rapido_remaining: number };
      onCreated(data.page, data.rapido_remaining);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-[#111827] border border-white/10 rounded-2xl p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg uppercase tracking-wider text-white font-bold">
            {pickLocalized(language, 'Sayfa Ekle', 'Add Page')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
            {pickLocalized(language, 'Görsel URL\'leri (her satıra 1, maks. 8)', 'Image URLs (1 per line, max 8)')}
          </span>
          <textarea
            value={imageUrlsText}
            onChange={(e) => setImageUrlsText(e.target.value)}
            rows={5}
            placeholder="https://..."
            className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-sm font-mono resize-none focus:outline-none focus:border-amber-400/50 placeholder:text-slate-600"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
            {pickLocalized(language, 'Tema', 'Theme')}
          </span>
          <div className="flex gap-2">
            {(['light', 'dark', 'warm'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 py-2 rounded-lg border font-mono text-xs uppercase tracking-widest transition-colors ${
                  theme === t
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                }`}
              >
                {pickLocalized(language,
                  t === 'light' ? 'Açık' : t === 'dark' ? 'Koyu' : 'Sıcak',
                  t === 'light' ? 'Light' : t === 'dark' ? 'Dark' : 'Warm'
                )}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-red-400 font-mono text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading || rapidoBalance < 4}
          className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-black font-mono text-xs uppercase tracking-widest font-bold transition-colors"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Plus size={15} />
          )}
          {pickLocalized(language, 'AI ile Oluştur', 'Generate with AI')}
          <span className="ml-1 opacity-70">— 4 rapido</span>
        </button>

        {rapidoBalance < 4 && (
          <p className="text-center font-mono text-xs text-red-400">
            {pickLocalized(language, 'Yetersiz rapido bakiyesi.', 'Insufficient rapido balance.')}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// NewPortfolioModal
// ---------------------------------------------------------------------------

interface NewPortfolioModalProps {
  getJWT: () => Promise<string>;
  onCreated: (portfolio: PortfolioSummary) => void;
  onClose: () => void;
}

function NewPortfolioModal({ getJWT, onCreated, onClose }: NewPortfolioModalProps) {
  const language = useLanguage();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!title.trim()) return;
    setError('');
    setLoading(true);
    try {
      const jwt = await getJWT();
      const res = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ title: title.trim(), subtitle: subtitle.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Failed');
      }
      const data = await res.json() as { portfolio: PortfolioSummary };
      onCreated(data.portfolio);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-[#111827] border border-white/10 rounded-2xl p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg uppercase tracking-wider text-white font-bold">
            {pickLocalized(language, 'Yeni Portfolyo', 'New Portfolio')}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
            {pickLocalized(language, 'Başlık *', 'Title *')}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={pickLocalized(language, 'Portfolyo başlığı', 'Portfolio title')}
            className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-amber-400/50 placeholder:text-slate-600"
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate(); }}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
            {pickLocalized(language, 'Alt Başlık', 'Subtitle')}
          </span>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder={pickLocalized(language, 'İsteğe bağlı', 'Optional')}
            className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-amber-400/50 placeholder:text-slate-600"
          />
        </label>

        {error && (
          <p className="text-red-400 font-mono text-xs bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </p>
        )}

        <button
          onClick={handleCreate}
          disabled={loading || !title.trim()}
          className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-black font-mono text-xs uppercase tracking-widest font-bold transition-colors"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          {pickLocalized(language, 'Oluştur', 'Create')}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function PortfolioPage() {
  const language = useLanguage();
  const { user, profile, loading: authLoading, getJWT } = useAuth();

  // View state
  const [selectedPortfolio, setSelectedPortfolio] = useState<PortfolioSummary | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAddPage, setShowAddPage] = useState(false);

  // Data
  const [portfolios, setPortfolios] = useState<PortfolioSummary[]>([]);
  const [pages, setPages] = useState<PortfolioPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [portfoliosLoading, setPortfoliosLoading] = useState(false);
  const [pagesLoading, setPagesLoading] = useState(false);

  // Local rapido balance (updated optimistically after page creation)
  const [rapidoBalance, setRapidoBalance] = useState<number>(profile?.rapido_pens ?? 0);

  useEffect(() => {
    setRapidoBalance(profile?.rapido_pens ?? 0);
  }, [profile?.rapido_pens]);

  // ------ Load portfolios ------
  const loadPortfolios = useCallback(async () => {
    if (!user) return;
    setPortfoliosLoading(true);
    try {
      const jwt = await getJWT();
      const res = await fetch('/api/portfolio', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { portfolios: PortfolioSummary[] };
      setPortfolios(data.portfolios ?? []);
    } catch {
      // silent
    } finally {
      setPortfoliosLoading(false);
    }
  }, [user, getJWT]);

  useEffect(() => {
    if (!authLoading) void loadPortfolios();
  }, [authLoading, loadPortfolios]);

  // ------ Load pages for selected portfolio ------
  const loadPages = useCallback(async (portfolioId: string) => {
    setPagesLoading(true);
    try {
      const jwt = await getJWT();
      const res = await fetch(`/api/portfolio/${portfolioId}/pages`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!res.ok) return;
      const data = await res.json() as { pages: PortfolioPage[] };
      const sorted = (data.pages ?? []).sort((a, b) => a.pageIndex - b.pageIndex);
      setPages(sorted);
      if (sorted.length > 0 && !selectedPageId) {
        setSelectedPageId(sorted[0].id);
      }
    } catch {
      // silent
    } finally {
      setPagesLoading(false);
    }
  }, [getJWT, selectedPageId]);

  useEffect(() => {
    if (selectedPortfolio) {
      setPages([]);
      setSelectedPageId(null);
      void loadPages(selectedPortfolio.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPortfolio?.id]);

  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? null;
  const selectedPageLayout = selectedPage ? parseLayout(selectedPage.layoutJson) : null;

  // ------ Handlers ------
  const handlePortfolioCreated = useCallback((portfolio: PortfolioSummary) => {
    setPortfolios((prev) => [portfolio, ...prev]);
    setSelectedPortfolio(portfolio);
    setShowNewModal(false);
  }, []);

  const handlePageCreated = useCallback((page: PortfolioPage, remainingRapido: number) => {
    setPages((prev) => {
      const next = [...prev, page].sort((a, b) => a.pageIndex - b.pageIndex);
      return next;
    });
    setSelectedPageId(page.id);
    setShowAddPage(false);
    setRapidoBalance(remainingRapido);
    // Update portfolio page count
    setSelectedPortfolio((prev) => prev ? { ...prev, pageCount: prev.pageCount + 1 } : prev);
    setPortfolios((prev) => prev.map((p) =>
      p.id === page.portfolioId ? { ...p, pageCount: p.pageCount + 1 } : p
    ));
  }, []);

  const handleLayoutSaved = useCallback((layout: PageLayout) => {
    if (!selectedPageId) return;
    setPages((prev) =>
      prev.map((p) =>
        p.id === selectedPageId ? { ...p, layoutJson: JSON.stringify(layout) } : p
      )
    );
  }, [selectedPageId]);

  // ------ Auth guard ------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 size={32} className="text-amber-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <Layers size={48} className="text-amber-400 mx-auto mb-4" />
          <h2 className="font-display text-2xl uppercase tracking-wider font-bold text-white mb-2">
            {pickLocalized(language, 'Portfolyo Oluşturucu', 'Portfolio Builder')}
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            {pickLocalized(language, 'Devam etmek için giriş yapmanız gerekiyor.', 'You need to sign in to continue.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">

        {/* ---------------------------------------------------------------- */}
        {/* VIEW 1 — Portfolio List                                           */}
        {/* ---------------------------------------------------------------- */}
        {!selectedPortfolio && (
          <motion.div
            key="portfolio-list"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-8"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-amber-400 mb-1">
                  {pickLocalized(language, 'Portfolyo Modülü', 'Portfolio Module')}
                </p>
                <h1 className="font-display text-3xl sm:text-4xl uppercase tracking-wider font-bold text-white">
                  {pickLocalized(language, 'Portfolyo Oluşturucu', 'Portfolio Builder')}
                </h1>
              </div>
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 rounded-lg text-black font-mono text-xs uppercase tracking-widest font-bold transition-colors"
              >
                <Plus size={15} />
                {pickLocalized(language, 'Yeni Portfolyo', 'New Portfolio')}
              </button>
            </div>

            {/* Rapido balance */}
            <div className="flex items-center gap-2 px-4 py-2 bg-[#111827] border border-white/10 rounded-lg w-fit">
              <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
                {pickLocalized(language, 'Rapido Bakiye', 'Rapido Balance')}
              </span>
              <span className="font-mono text-sm font-bold text-amber-400">{rapidoBalance}</span>
              <span className="font-mono text-xs text-slate-500">
                {pickLocalized(language, '· 4 rapido / sayfa', '· 4 rapido / page')}
              </span>
            </div>

            {/* Portfolios grid */}
            {portfoliosLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={28} className="text-amber-400 animate-spin" />
              </div>
            ) : portfolios.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 border border-dashed border-white/10 rounded-2xl"
              >
                <Layers size={40} className="text-slate-600 mb-4" />
                <p className="font-mono text-sm text-slate-500 uppercase tracking-widest">
                  {pickLocalized(language, 'Henüz portfolyo yok', 'No portfolios yet')}
                </p>
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-300 font-mono text-xs uppercase tracking-widest transition-colors"
                >
                  <Plus size={14} />
                  {pickLocalized(language, 'İlk Portfolyonu Oluştur', 'Create Your First Portfolio')}
                </button>
              </motion.div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {portfolios.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="group flex flex-col gap-3 p-5 bg-[#111827] border border-white/10 hover:border-amber-400/30 rounded-2xl transition-colors cursor-pointer"
                    onClick={() => setSelectedPortfolio(p)}
                  >
                    {/* Cover */}
                    <div className="w-full aspect-[1/1.414] bg-black/50 rounded-lg overflow-hidden border border-white/5">
                      {p.coverUrl ? (
                        <img src={p.coverUrl} alt={p.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Layers size={28} className="text-slate-700" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-base uppercase tracking-wide font-bold text-white line-clamp-1">
                          {p.title}
                        </h3>
                        <span className="shrink-0 px-2 py-0.5 bg-amber-400/10 border border-amber-400/20 rounded font-mono text-[10px] text-amber-300">
                          {p.pageCount} {pickLocalized(language, 'sayfa', 'pages')}
                        </span>
                      </div>
                      {p.subtitle && (
                        <p className="font-mono text-xs text-slate-400 line-clamp-1">{p.subtitle}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedPortfolio(p); }}
                      className="flex items-center justify-center gap-1.5 w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-mono text-xs uppercase tracking-widest transition-colors"
                    >
                      {pickLocalized(language, 'Düzenle', 'Edit')}
                      <ChevronRight size={13} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* VIEW 2 — Portfolio Editor                                         */}
        {/* ---------------------------------------------------------------- */}
        {selectedPortfolio && (
          <motion.div
            key="portfolio-editor"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-6"
          >
            {/* Top bar */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => { setSelectedPortfolio(null); setPages([]); setSelectedPageId(null); }}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-slate-300 font-mono text-xs uppercase tracking-widest transition-colors"
              >
                <ArrowLeft size={14} />
                {pickLocalized(language, 'Geri', 'Back')}
              </button>
              <div className="flex flex-col">
                <h2 className="font-display text-xl sm:text-2xl uppercase tracking-wider font-bold text-white leading-none">
                  {selectedPortfolio.title}
                </h2>
                {selectedPortfolio.subtitle && (
                  <p className="font-mono text-xs text-slate-400 mt-0.5">{selectedPortfolio.subtitle}</p>
                )}
              </div>
              <div className="flex-1" />
              <span className="font-mono text-xs text-slate-500">
                {pickLocalized(language, 'Bakiye:', 'Balance:')} <span className="text-amber-400 font-bold">{rapidoBalance}</span>
              </span>
            </div>

            {/* Pages strip */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-widest text-slate-400">
                  {pickLocalized(language, 'Sayfalar', 'Pages')}
                </span>
                <button
                  onClick={() => setShowAddPage(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/30 rounded text-amber-300 font-mono text-xs uppercase tracking-widest transition-colors"
                >
                  <Plus size={12} />
                  {pickLocalized(language, 'Sayfa Ekle', 'Add Page')}
                  <span className="opacity-60">— 4 rapido</span>
                </button>
              </div>

              {pagesLoading ? (
                <div className="flex gap-3 py-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="w-[57px] h-[80px] bg-white/5 rounded animate-pulse" />
                  ))}
                </div>
              ) : pages.length === 0 ? (
                <div className="flex items-center gap-3 py-3 px-4 bg-white/5 border border-dashed border-white/10 rounded-xl">
                  <ImageIcon size={18} className="text-slate-600" />
                  <p className="font-mono text-xs text-slate-500">
                    {pickLocalized(language, 'Henüz sayfa yok. Yeni sayfa ekleyebilirsiniz.', 'No pages yet. Add a new page.')}
                  </p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {pages.map((page, idx) => {
                    const layout = parseLayout(page.layoutJson);
                    const isActive = page.id === selectedPageId;
                    return (
                      <button
                        key={page.id}
                        onClick={() => setSelectedPageId(page.id)}
                        style={{ backgroundColor: layout.background }}
                        className={`shrink-0 w-[57px] h-[80px] rounded border-2 transition-all overflow-hidden ${
                          isActive ? 'border-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.3)]' : 'border-white/10 hover:border-white/30'
                        }`}
                        title={`${pickLocalized(language, 'Sayfa', 'Page')} ${idx + 1}`}
                      >
                        <div className="w-full h-full relative">
                          {layout.elements.slice(0, 5).map((el) => (
                            <div
                              key={el.id}
                              style={{
                                position: 'absolute',
                                left: `${el.x}%`,
                                top: `${el.y}%`,
                                width: `${el.w}%`,
                                height: `${el.h}%`,
                                backgroundColor: el.type === 'shape' ? (el.backgroundColor ?? '#888') : undefined,
                                fontSize: 2,
                                overflow: 'hidden',
                              }}
                            >
                              {el.type === 'image' && el.imageUrl && (
                                <img src={el.imageUrl} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                          ))}
                          <span
                            className="absolute bottom-0.5 right-0.5 font-mono text-[6px] px-0.5 rounded"
                            style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff' }}
                          >
                            {idx + 1}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Canvas editor */}
            {selectedPage && selectedPageLayout ? (
              <CanvasEditor
                key={selectedPage.id}
                pageId={selectedPage.id}
                portfolioId={selectedPortfolio.id}
                initialLayout={selectedPageLayout}
                onSave={handleLayoutSaved}
                getJWT={getJWT}
                onRapidoUpdate={setRapidoBalance}
              />
            ) : !pagesLoading && pages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-2xl">
                <RotateCcw size={32} className="text-slate-600 mb-3" />
                <p className="font-mono text-sm text-slate-500">
                  {pickLocalized(language, 'Düzenlemek için bir sayfa seçin veya yeni sayfa ekleyin.', 'Select a page or add a new one to start editing.')}
                </p>
              </div>
            ) : null}
          </motion.div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Modals & Drawers                                                    */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {showNewModal && (
          <NewPortfolioModal
            getJWT={getJWT}
            onCreated={handlePortfolioCreated}
            onClose={() => setShowNewModal(false)}
          />
        )}
        {showAddPage && selectedPortfolio && (
          <AddPageDrawer
            portfolioId={selectedPortfolio.id}
            rapidoBalance={rapidoBalance}
            getJWT={getJWT}
            onCreated={handlePageCreated}
            onClose={() => setShowAddPage(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
