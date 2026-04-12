'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

type PdfState = {
  pageCount: number;
  currentPage: number;
  loading: boolean;
  error: string | null;
};

type PanState = {
  x: number;
  y: number;
};

interface SimplePdfPreviewProps {
  src: string;
  fileName?: string;
  className?: string;
  showControls?: boolean;
  startPage?: number;
}

function getWorkerSources(version: string): string[] {
  return [
    '/pdf.worker.min.mjs',
    `/pdf.worker.min.mjs?version=${encodeURIComponent(version)}`,
    `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`,
  ];
}

export function SimplePdfPreview({
  src,
  fileName,
  className,
  showControls = true,
  startPage = 1,
}: SimplePdfPreviewProps) {
  const language = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);

  const [state, setState] = useState<PdfState>({
    pageCount: 0,
    currentPage: Math.max(1, startPage),
    loading: true,
    error: null,
  });

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; panX: number; panY: number }>({ x: 0, y: 0, panX: 0, panY: 0 });
  // Touch zoom state
  const lastTouchDist = useRef<number | null>(null);

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 5;

  const clampZoom = useCallback((z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)), []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Mouse wheel → zoom centered on cursor
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((prev) => clampZoom(prev + delta));
  }, [clampZoom]);

  // Mouse drag → pan
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.preventDefault();
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch events for mobile pinch-zoom and pan
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      setIsDragging(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      dragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  }, [zoom, pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && lastTouchDist.current !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = dist / lastTouchDist.current;
      setZoom((prev) => clampZoom(prev * factor));
      lastTouchDist.current = dist;
    } else if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStart.current.x;
      const dy = e.touches[0].clientY - dragStart.current.y;
      setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
    }
  }, [clampZoom, isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastTouchDist.current = null;
  }, []);

  const pageLabel = useMemo(() => {
    if (!state.pageCount) return 'PDF';
    return pickLocalized(language, `Sayfa ${state.currentPage}/${state.pageCount}`, `Page ${state.currentPage}/${state.pageCount}`);
  }, [state.currentPage, state.pageCount, language]);

  useEffect(() => {
    let cancelled = false;

    const loadDocument = async () => {
      setState((prev) => ({ ...prev, loading: true, error: null, pageCount: 0 }));

      try {
        const pdfjs = await import('pdfjs-dist');
        const workerSources = getWorkerSources(pdfjs.version);

        let loadedDoc: any = null;
        let lastError: unknown = null;

        for (const workerSrc of workerSources) {
          try {
            pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
            const loadingTask = pdfjs.getDocument({
              url: src,
              withCredentials: false,
              disableAutoFetch: true,
              disableStream: true,
              disableRange: true,
            });
            loadedDoc = await loadingTask.promise;
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (!loadedDoc) {
          throw lastError ?? new Error('PDF load failed');
        }

        if (cancelled) return;

        pdfDocRef.current = loadedDoc;
        setState((prev) => ({
          ...prev,
          loading: false,
          pageCount: loadedDoc.numPages,
          currentPage: Math.min(Math.max(1, startPage), loadedDoc.numPages),
        }));
      } catch {
        if (cancelled) return;
        pdfDocRef.current = null;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: pickLocalized(language, 'PDF önizlemesi yüklenemedi.', 'PDF preview could not be loaded.'),
          pageCount: 0,
        }));
      }
    };

    void loadDocument();

    return () => {
      cancelled = true;
      pdfDocRef.current = null;
    };
  }, [src, startPage]);

  useEffect(() => {
    let cancelled = false;

    const renderPage = async () => {
      const pdfDoc = pdfDocRef.current;
      const canvas = canvasRef.current;
      if (!pdfDoc || !canvas || state.loading || state.error) return;

      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }
      } catch {
        // Ignore stale render cancellation errors.
      }

      try {
        const page = await pdfDoc.getPage(state.currentPage);
        const baseViewport = page.getViewport({ scale: 1 });
        const containerWidth = Math.max(240, viewportRef.current?.clientWidth ?? baseViewport.width);
        const widthScale = containerWidth / Math.max(1, baseViewport.width);
        const pixelBudget = 4_500_000;
        const maxScaleByPixels = Math.sqrt(pixelBudget / Math.max(1, baseViewport.width * baseViewport.height));
        const scale = Math.max(0.2, Math.min(2, widthScale, maxScaleByPixels));
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));

        context.clearRect(0, 0, canvas.width, canvas.height);
        const renderTask = page.render({ canvasContext: context, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
      } catch (error) {
        if (cancelled) return;
        const maybeError = error as { name?: string };
        if (maybeError?.name === 'RenderingCancelledException') return;
        setState((prev) => ({ ...prev, error: pickLocalized(language, 'PDF sayfası render edilemedi.', 'PDF page could not be rendered.') }));
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
          renderTaskRef.current = null;
        }
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [state.currentPage, state.error, state.loading]);

  return (
    <div className={className ?? 'h-full w-full flex flex-col'}>
      {showControls ? (
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/50 px-2 py-1.5">
          <div className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-300">
            <FileText size={12} className="text-cyan-300" />
            <span className="truncate max-w-[180px]">{fileName || pageLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-slate-300 min-w-[86px] text-right">{pageLabel}</span>
            <button
              type="button"
              title={pickLocalized(language, 'Yakınlaştır', 'Zoom in')}
              onClick={() => setZoom((z) => clampZoom(z + 0.25))}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ZoomIn size={12} />
            </button>
            <button
              type="button"
              title={pickLocalized(language, 'Uzaklaştır', 'Zoom out')}
              onClick={() => setZoom((z) => clampZoom(z - 0.25))}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ZoomOut size={12} />
            </button>
            <button
              type="button"
              title={pickLocalized(language, 'Sıfırla', 'Reset')}
              onClick={resetView}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      ) : null}

      <div
        ref={viewportRef}
        className="relative flex-1 overflow-hidden bg-black/50 p-2"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {state.loading ? (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-slate-300 font-mono text-xs">
            <Loader2 size={14} className="animate-spin" /> {pickLocalized(language, 'Yükleniyor...', 'Loading...')}
          </div>
        ) : null}

        {state.error ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-slate-400 font-mono text-xs">
            {state.error}
          </div>
        ) : null}

        {/* Floating zoom overlay — shown when controls header is hidden */}
        {!showControls && !state.loading && !state.error ? (
          <div className="absolute top-1 right-1 z-10 flex gap-0.5 bg-black/50 rounded p-0.5">
            <button
              type="button"
              title={pickLocalized(language, 'Yakınlaştır', 'Zoom in')}
              onClick={() => setZoom((z) => clampZoom(z + 0.25))}
              className="p-1 rounded hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            >
              <ZoomIn size={11} />
            </button>
            <button
              type="button"
              title={pickLocalized(language, 'Uzaklaştır', 'Zoom out')}
              onClick={() => setZoom((z) => clampZoom(z - 0.25))}
              className="p-1 rounded hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            >
              <ZoomOut size={11} />
            </button>
            {zoom !== 1 ? (
              <button
                type="button"
                title={pickLocalized(language, 'Sıfırla', 'Reset')}
                onClick={resetView}
                className="p-1 rounded hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
              >
                <RotateCcw size={11} />
              </button>
            ) : null}
          </div>
        ) : null}

        <canvas
          ref={canvasRef}
          className={`mx-auto h-auto w-full max-w-full rounded border border-white/10 ${state.loading || state.error ? 'invisible' : 'visible'}`}
          style={{
            transformOrigin: 'center top',
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease',
            userSelect: 'none',
            touchAction: 'none',
          }}
        />
      </div>
    </div>
  );
}
