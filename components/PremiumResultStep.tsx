import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PenTool,
  X,
  ShieldAlert,
  CheckCircle2,
  GraduationCap,
  Layers3,
  FileImage,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { ChatDefense } from '@/components/ChatDefense';
import { CommunityShareButton, type CommunityShareOptions } from '@/components/CommunityShareButton';
import { InteractiveImagePreview } from '@/components/InteractiveImagePreview';
import { NewProjectButton } from '@/components/NewProjectButton';
import { PreserveAnalysisButton } from '@/components/PreserveAnalysisButton';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

import type { DefenseMessage, PremiumData } from '@/types';

/** previousProject stores raw base64 without a data: prefix. */
function toImageSource(value: string, mimeType: string | undefined): string {
  if (/^(data:|blob:|https?:)/i.test(value)) return value;
  const safeMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
  return `data:${safeMime};base64,${value}`;
}

interface PremiumResultStepProps {
  premiumData: PremiumData;
  previewUrl: string | null;
  mimeType: string | null;
  selectedFlawIndex: number | null;
  setSelectedFlawIndex: (val: number | null) => void;
  handleNewProject: () => void;
  isPremiumUser: boolean;
  isDefending: boolean;
  setIsDefending: (val: boolean) => void;
  defenseTurnCount: number;
  defenseMessages: DefenseMessage[];
  isDefenseLoading: boolean;
  defenseInput: string;
  setDefenseInput: (val: string) => void;
  handleDefenseSubmit: () => void;
  handlePreserveAnalysis?: () => Promise<boolean> | void;
  previousProject: {
    imageBase64?: string;
    mimeType?: string;
    pagePreviews?: string[];
  } | null;
  handleShareToCommunity?: (options: CommunityShareOptions) => Promise<boolean> | void;
}

type DisplayPage = {
  page: number;
  pageLabel: string;
  previewUrl: string;
  mimeType: string;
  sourceName?: string;
};

const severityStyles = {
  LOW: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100',
  MEDIUM: 'border-amber-400/40 bg-amber-500/10 text-amber-100',
  HIGH: 'border-neon-red/40 bg-neon-red/10 text-neon-red',
  CRITICAL: 'border-neon-red bg-neon-red/20 text-white',
} as const;

function getSeverityLabel(severity: string | undefined, language: SupportedLanguage): string {
  switch (severity) {
    case 'LOW':
      return pickLocalized(language, 'Düşük', 'Low');
    case 'HIGH':
      return pickLocalized(language, 'Yüksek', 'High');
    case 'CRITICAL':
      return pickLocalized(language, 'Kritik', 'Critical');
    case 'MEDIUM':
    default:
      return pickLocalized(language, 'Orta', 'Medium');
  }
}

export function PremiumResultStep({
  premiumData,
  previewUrl,
  mimeType,
  selectedFlawIndex,
  setSelectedFlawIndex,
  handleNewProject,
  isPremiumUser,
  isDefending,
  setIsDefending,
  defenseTurnCount,
  defenseMessages,
  isDefenseLoading,
  defenseInput,
  setDefenseInput,
  handleDefenseSubmit,
  handlePreserveAnalysis,
  previousProject,
  handleShareToCommunity,
}: PremiumResultStepProps) {
  const exportRef = useRef<HTMLDivElement>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [exportingScale, setExportingScale] = useState<number | null>(null);
  const language = useLanguage();
  const [exportError, setExportError] = useState<string | null>(null);

  const pages = useMemo<DisplayPage[]>(() => {
    const sheetLabel = (page: number) => `${pickLocalized(language, 'Pafta', 'Sheet')} ${page}`;
    if (premiumData.pages && premiumData.pages.length > 0) {
      return premiumData.pages.map((entry, index) => ({
        page: entry.page || index + 1,
        pageLabel: sheetLabel(entry.page || index + 1),
        previewUrl: entry.previewUrl,
        mimeType: entry.mimeType,
        sourceName: entry.sourceName,
      }));
    }

    if (previewUrl) {
      return [
        {
          page: 1,
          pageLabel: sheetLabel(1),
          previewUrl,
          mimeType: mimeType ?? 'image/jpeg',
        },
      ];
    }

    return [];
  }, [premiumData.pages, previewUrl, mimeType, language]);

  const [manualActivePage, setManualActivePage] = useState<number>(pages[0]?.page ?? 1);

  const selectedFlawPage =
    selectedFlawIndex !== null && selectedFlawIndex >= 0
      ? premiumData.flaws[selectedFlawIndex]?.page ?? null
      : null;

  const activePage = useMemo(() => {
    const candidate = selectedFlawPage ?? manualActivePage;
    if (pages.some((entry) => entry.page === candidate)) return candidate;
    return pages[0]?.page ?? 1;
  }, [manualActivePage, pages, selectedFlawPage]);

  const activePageEntry = useMemo(
    () => pages.find((entry) => entry.page === activePage) ?? pages[0] ?? null,
    [activePage, pages],
  );
  const activePageIndex = useMemo(() => {
    if (!activePageEntry) return 0;
    const index = pages.findIndex((entry) => entry.page === activePageEntry.page);
    return index >= 0 ? index : 0;
  }, [activePageEntry, pages]);

  const flawRows = useMemo(
    () =>
      premiumData.flaws.map((flaw, index) => ({
        flaw,
        index,
      })),
    [premiumData.flaws],
  );

  const visibleFlaws = useMemo(
    () =>
      flawRows.filter(({ flaw }) => {
        if (!flaw.page) return activePageEntry ? activePageEntry.page === 1 : true;
        return flaw.page === (activePageEntry?.page ?? 1);
      }),
    [activePageEntry, flawRows],
  );

  const currentPreview = activePageEntry?.previewUrl ?? previewUrl;
  const previousPreviewRaw =
    previousProject?.pagePreviews?.[activePageIndex] ??
    previousProject?.imageBase64 ??
    null;
  const previousPreview = previousPreviewRaw ? toImageSource(previousPreviewRaw, previousProject?.mimeType) : null;
  const sheetLabel = (page: number) => `${pickLocalized(language, 'Pafta', 'Sheet')} ${page}`;

  const handleExport = async (scale = 1) => {
    if (!exportRef.current || exportingScale !== null) return;
    setExportingScale(scale);
    setExportError(null);

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(exportRef.current, { backgroundColor: '#0A0F1A', scale });
      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl.startsWith('data:image/')) {
        throw new Error('Security check failed: Invalid data URL');
      }
      const link = document.createElement('a');
      link.download = `draw-or-die-kirmizi-kalem-pafta-${activePage}${scale > 1 ? '-high' : ''}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      setExportError(
        pickLocalized(
          language,
          'Pafta görseli oluşturulamadı. Sayfayı yenileyip indirmeyi tekrar dene.',
          'The sheet image could not be created. Refresh the page and try the download again.',
        ),
      );
    } finally {
      setExportingScale(null);
    }
  };

  return (
    <motion.div
      key="premium"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8"
    >
      <div className="flex flex-col gap-4 lg:sticky lg:top-24 h-fit">
        <div className="flex justify-between items-center mb-0">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide flex items-center gap-2 text-neon-red">
            <PenTool aria-hidden="true" /> {pickLocalized(language, 'Kırmızı Kalem Revizyonu', 'Red Pen Revision')}
          </h2>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <PreserveAnalysisButton
              onPreserve={handlePreserveAnalysis}
              className="p-2 border border-emerald-400/40 rounded-lg hover:bg-emerald-500/10 transition-colors text-emerald-100 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
            />
            <CommunityShareButton
              onShare={handleShareToCommunity}
              className="p-2 border border-cyan-400/40 rounded-lg hover:bg-cyan-500/10 transition-colors text-cyan-100 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exportingScale !== null}
              aria-busy={exportingScale === 1}
              className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-slate-300 flex items-center gap-2 disabled:cursor-wait disabled:opacity-60"
              title={pickLocalized(language, 'Roast\'ı İndir', 'Download roast')}
            >
              <span className="font-mono font-bold text-[11px] uppercase tracking-wider">{pickLocalized(language, 'İndir', 'Download')}</span>
              {exportingScale === 1 ? (
                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" aria-hidden="true" />
              ) : (
                <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleExport(2)}
              disabled={exportingScale !== null}
              aria-busy={exportingScale === 2}
              className="p-2 border border-cyan-400/30 rounded-lg hover:bg-cyan-500/10 transition-colors text-cyan-200 flex items-center gap-2 disabled:cursor-wait disabled:opacity-60"
              title={pickLocalized(language, 'Yüksek çözünürlükte kaydet', 'Save high resolution')}
            >
              {exportingScale === 2 ? (
                <Loader2 size={14} strokeWidth={1.5} className="animate-spin" aria-hidden="true" />
              ) : null}
              <span className="font-mono font-bold text-[11px] uppercase tracking-wider">{pickLocalized(language, 'Yüksek Çözünürlük', 'High Res')}</span>
            </button>
          </div>
        </div>

        {exportError ? (
          <div role="alert" className="rounded-lg border border-red-500/25 bg-red-500/8 p-4">
            <p className="font-mono text-[11px] uppercase tracking-wider text-red-300">
              {pickLocalized(language, 'Dışa aktarma başarısız', 'Export failed')}
            </p>
            <p className="mt-1 text-sm text-red-200">{exportError}</p>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/10 bg-[#111827] px-3 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-300">
            <Layers3 size={14} className="text-cyan-300" aria-hidden="true" />
            {activePageEntry?.pageLabel ?? pickLocalized(language, 'Pafta', 'Sheet')}
            {activePageEntry?.sourceName ? <span className="text-slate-500">({activePageEntry.sourceName})</span> : null}
          </div>
          {previousProject && previousPreview && (
            <button
              type="button"
              onClick={() => setShowCompare((prev) => !prev)}
              aria-pressed={showCompare}
              className="bg-black/80 text-white px-3 py-1.5 rounded-full font-mono text-[10px] tracking-wider border border-white/20 hover:border-yellow-500 transition-colors"
            >
              {showCompare
                ? pickLocalized(language, 'Karşılaştırmayı Kapat', 'Close comparison')
                : pickLocalized(language, 'Önceki Hali ile Karşılaştır', 'Compare with previous version')}
            </button>
          )}
        </div>

        <div ref={exportRef} className="relative w-full bg-black border border-neon-red/50 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(255,0,51,0.15)] group min-h-[520px]">
          {showCompare && previousPreview && currentPreview ? (
            <div className="absolute inset-0 flex relative border-4 border-yellow-500/30">
              <div className="w-1/2 h-full border-r border-yellow-500 relative bg-black">
                <img src={previousPreview} alt={pickLocalized(language, 'Önce', 'Before')} className="absolute top-0 left-0 w-[200%] max-w-none h-full object-contain object-left pointer-events-none opacity-70 grayscale" />
                <span className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded">{pickLocalized(language, 'Önceki Hali', 'Previous State')}</span>
              </div>
              <div className="w-1/2 h-full relative overflow-hidden bg-black">
                <img src={currentPreview} alt={pickLocalized(language, 'Sonra', 'After')} className="absolute top-0 right-0 w-[200%] max-w-none h-full object-contain object-right pointer-events-none" />
                <span className="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded">{pickLocalized(language, 'Revize Edilmiş', 'Revised')}</span>
              </div>
            </div>
          ) : currentPreview ? (
            <InteractiveImagePreview
              src={currentPreview}
              alt={sheetLabel(activePageEntry?.page ?? 1)}
              className="h-full w-full"
              showControls={false}
              imageClassName="w-full h-full object-contain bg-black/40"
              overlay={
                <>
                  {visibleFlaws
                    .filter(({ flaw }) =>
                      typeof flaw.x === 'number' &&
                      typeof flaw.y === 'number' &&
                      typeof flaw.width === 'number' &&
                      typeof flaw.height === 'number',
                    )
                    .map(({ flaw, index }) => {
                      const isSelected = selectedFlawIndex === index;
                      const flawTitle = `${pickLocalized(language, 'Sorun', 'Issue')} #${index + 1}`;
                      return (
                        <div
                          key={`${index}-${flaw.reason}`}
                          className={`pointer-events-none absolute ${isSelected ? 'z-20' : 'z-10'}`}
                          style={{
                            left: `${flaw.x}%`,
                            top: `${flaw.y}%`,
                            width: `${flaw.width}%`,
                            height: `${flaw.height}%`,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedFlawIndex(isSelected ? null : index)}
                            aria-pressed={isSelected}
                            aria-label={`${flawTitle}: ${flaw.reason}`}
                            className={`group pointer-events-auto absolute inset-0 border-2 transition-all flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400 ${isSelected ? 'border-yellow-400 bg-yellow-400/20 scale-105 shadow-[0_0_15px_rgba(250,204,21,0.5)] cursor-default' : 'border-neon-red bg-neon-red/10 hover:bg-neon-red/30 cursor-pointer'}`}
                          >
                            <span aria-hidden="true" className={`absolute -top-3 -right-3 w-6 h-6 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg transition-colors ${isSelected ? 'bg-yellow-500' : 'bg-neon-red'}`}>
                              {index + 1}
                            </span>

                            {!isSelected && (
                              <span aria-hidden="true" className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-black border border-neon-red p-2 text-left text-xs text-white opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none z-10">
                                {flaw.reason}
                              </span>
                            )}
                          </button>

                          {isSelected && (
                            <div className="pointer-events-auto absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 sm:w-72 bg-black border border-yellow-500 p-3 text-sm text-white z-30 shadow-2xl rounded-lg cursor-auto">
                              <div className="flex justify-between items-start mb-1 gap-2">
                                <span className="font-bold text-yellow-500">{flawTitle}</span>
                                <span className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${severityStyles[flaw.severity ?? 'MEDIUM']}`}>
                                  {getSeverityLabel(flaw.severity, language)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedFlawIndex(null)}
                                  className="text-slate-400 hover:text-white p-1 -m-1"
                                  aria-label={pickLocalized(language, `${flawTitle} detayını kapat`, `Close ${flawTitle} details`)}
                                >
                                  <X size={14} aria-hidden="true" />
                                </button>
                              </div>
                              <p>{flaw.reason}</p>
                              {flaw.drawingGuide ? (
                                <p className="mt-2 text-xs text-yellow-100">
                                  {pickLocalized(language, 'Çizim yönlendirmesi', 'Drawing guide')}: {flaw.drawingGuide}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </>
              }
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-sm">
              {pickLocalized(language, 'Önizleme bulunamadı.', 'Preview not available.')}
            </div>
          )}
        </div>

        {pages.length > 1 && (
          <div className="rounded-xl border border-white/10 bg-[#111827] p-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400 mb-2">
              {pickLocalized(language, 'Analiz Paftaları', 'Analyzed Sheets')}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pages.map((page) => {
                const selected = page.page === activePageEntry?.page;
                return (
                  <button
                    key={`page-${page.page}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedFlawIndex(null);
                      setManualActivePage(page.page);
                    }}
                    className={`min-w-[140px] rounded-lg border px-3 py-2 text-left transition-colors ${selected ? 'border-neon-red bg-neon-red/10 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30'}`}
                  >
                    <span className="block text-[10px] font-mono uppercase tracking-widest">{page.pageLabel}</span>
                    <span className="mt-1 block text-xs truncate">
                      {page.sourceName ?? pickLocalized(language, 'Studio Desk Dosyası', 'Studio Desk file')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 h-full max-h-[900px] overflow-y-auto custom-scrollbar pr-2 pb-8">
        {premiumData.summary && (
          <div className="bg-[#111827] border border-white/10 rounded-xl p-6">
            <h3 className="font-mono text-sm uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
              <FileImage size={16} className="text-cyan-300" aria-hidden="true" /> {pickLocalized(language, 'Pafta Özeti', 'Sheet Summary')}
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-line text-slate-300">{premiumData.summary}</p>
          </div>
        )}

        <div className="bg-[#111827] border border-white/10 rounded-xl p-6">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
            <ShieldAlert size={16} className="text-neon-red" aria-hidden="true" /> {pickLocalized(language, 'Tespit Edilen Kritik Hatalar', 'Critical Issues Found')}
          </h3>
          <ul className="space-y-3">
            {flawRows.map(({ flaw, index }) => {
              const selected = selectedFlawIndex === index;
              return (
                <li key={`${index}-${flaw.reason}`}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSelectedFlawIndex(selected ? null : index);
                      if (flaw.page) setManualActivePage(flaw.page);
                    }}
                    className={`flex w-full items-start gap-3 p-3 rounded-lg text-left transition-colors border ${selected ? 'bg-yellow-500/10 border-yellow-500/30 text-white' : 'bg-white/5 border-transparent text-slate-300 hover:bg-white/10'}`}
                  >
                    <span aria-hidden="true" className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${selected ? 'bg-yellow-500 text-black' : 'bg-neon-red text-white'}`}>
                      {index + 1}
                    </span>
                    <span className="leading-relaxed text-sm">
                      <span className={`mb-2 inline-flex rounded border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider ${severityStyles[flaw.severity ?? 'MEDIUM']}`}>
                        {getSeverityLabel(flaw.severity, language)}
                      </span>
                      <span className="block">{flaw.reason}</span>
                      {flaw.page ? <span className="block text-[11px] text-slate-400 mt-1">{sheetLabel(flaw.page)}</span> : null}
                      {flaw.drawingGuide ? (
                        <span className="block text-[11px] text-yellow-100 mt-1">
                          {pickLocalized(language, 'Çizim', 'Drawing')}: {flaw.drawingGuide}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="bg-[#111827] border border-white/10 rounded-xl p-6">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" /> {pickLocalized(language, 'Pratik Çözüm Raporu', 'Practical Solutions Report')}
          </h3>
          <ul className="space-y-4">
            {premiumData.practicalSolutions.map((sol: string, idx: number) => (
              <li key={`solution-${idx}`} className="flex items-start gap-3 text-slate-300">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-mono mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-relaxed">{sol}</span>
              </li>
            ))}
          </ul>
        </div>

        {premiumData.drawingInstructions && premiumData.drawingInstructions.length > 0 && (
          <div className="bg-[#111827] border border-white/10 rounded-xl p-6">
            <h3 className="font-mono text-sm uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
              <Layers3 size={16} className="text-amber-400" aria-hidden="true" /> {pickLocalized(language, 'Çizim Yönlendirmeleri', 'Drawing Guidance')}
            </h3>
            <ul className="space-y-3">
              {premiumData.drawingInstructions.map((entry, idx) => (
                <li key={`guide-${idx}`} className="text-sm text-slate-300 leading-relaxed">
                  <span className="mr-2 text-amber-300 font-mono">{idx + 1}.</span>
                  {entry}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-[#111827] border border-white/10 rounded-xl p-6">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2 mb-4">
            {pickLocalized(language, 'Referans Yönlendirmesi', 'Reference Guidance')}
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
              <GraduationCap size={24} className="text-slate-400" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-bold text-white mb-1">{premiumData.reference}</p>
              <p className="text-sm text-slate-400">
                {pickLocalized(
                  language,
                  'Bu projeyi kurtarmak için bu referansı detaylıca incelemelisin.',
                  'Study this reference in detail to rescue the project.',
                )}
              </p>
            </div>
          </div>
        </div>

        <ChatDefense
          isPremiumUser={isPremiumUser}
          isDefending={isDefending}
          setIsDefending={setIsDefending}
          defenseTurnCount={defenseTurnCount}
          defenseMessages={defenseMessages}
          isDefenseLoading={isDefenseLoading}
          defenseInput={defenseInput}
          setDefenseInput={setDefenseInput}
          handleDefenseSubmit={handleDefenseSubmit}
        />

        <NewProjectButton
          onConfirm={handleNewProject}
          className="mt-6 w-full rounded-lg py-4 font-mono text-[11px] font-bold uppercase tracking-wider border border-white/[0.13] text-slate-200 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" /> {pickLocalized(language, 'Yeni Proje Yükle', 'Upload New Project')}
        </NewProjectButton>
      </div>
    </motion.div>
  );
}
