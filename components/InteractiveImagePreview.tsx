'use client';

import type { ReactNode } from 'react';
import { Image as ImageIcon, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { usePointerPinchZoom } from '@/hooks/usePointerPinchZoom';

type InteractiveImagePreviewProps = {
  src: string;
  alt: string;
  className?: string;
  fileName?: string;
  showControls?: boolean;
  overlay?: ReactNode;
  imageClassName?: string;
};

export function InteractiveImagePreview({
  src,
  alt,
  className,
  fileName,
  showControls = true,
  overlay,
  imageClassName,
}: InteractiveImagePreviewProps) {
  const language = useLanguage();
  const {
    zoom,
    pan,
    isDragging,
    hasInteracted,
    surfaceTouchAction,
    zoomIn,
    zoomOut,
    resetView,
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = usePointerPinchZoom({ minZoom: 0.5, maxZoom: 5, wheelStep: 0.15 });

  const hintText = pickLocalized(
    language,
    'Yakınlaştırmak için tekerlek veya iki parmak kullan. Zoom açıkken sürükleyerek gezinebilirsin.',
    'Use wheel or two fingers to zoom. Drag to pan while zoomed in.',
  );

  const headerLabel = fileName || pickLocalized(language, 'Görsel Önizleme', 'Image preview');

  return (
    <div className={className ?? 'h-full w-full flex flex-col'} data-testid="interactive-image-preview">
      {showControls ? (
        <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/50 px-2 py-1.5">
          <div className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-300">
            <ImageIcon size={12} className="text-cyan-300" />
            <span className="truncate max-w-[220px]">{headerLabel}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-slate-300 min-w-[72px] text-right">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              title={pickLocalized(language, 'Yakınlaştır', 'Zoom in')}
              onClick={zoomIn}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <ZoomIn size={12} />
            </button>
            <button
              type="button"
              title={pickLocalized(language, 'Uzaklaştır', 'Zoom out')}
              onClick={zoomOut}
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
        className="relative flex-1 overflow-hidden bg-black/50"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          touchAction: surfaceTouchAction,
        }}
      >
        {!showControls ? (
          <div className="absolute top-1 right-1 z-20 flex gap-0.5 rounded bg-black/50 p-0.5">
            <button
              type="button"
              title={pickLocalized(language, 'Yakınlaştır', 'Zoom in')}
              onClick={zoomIn}
              className="p-1 rounded hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            >
              <ZoomIn size={11} />
            </button>
            <button
              type="button"
              title={pickLocalized(language, 'Uzaklaştır', 'Zoom out')}
              onClick={zoomOut}
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

        {!hasInteracted ? (
          <div className="pointer-events-none absolute left-2 right-2 bottom-2 z-10 rounded border border-white/15 bg-black/55 px-2 py-1 text-[11px] text-slate-200">
            {hintText}
          </div>
        ) : null}

        <div
          className="relative h-full w-full"
          style={{
            transformOrigin: 'center center',
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transition: isDragging ? 'none' : 'transform 0.1s ease',
            userSelect: 'none',
          }}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            className={imageClassName ?? 'h-full w-full object-contain'}
          />
          {overlay ? <div className="pointer-events-none absolute inset-0">{overlay}</div> : null}
        </div>
      </div>
    </div>
  );
}
