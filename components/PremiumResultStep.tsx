import { useLanguage } from "@/components/RuntimeTextLocalizer";
import { pickLocalized } from "@/lib/i18n";
import { motion } from 'framer-motion';
import { PenTool, X, ShieldAlert, CheckCircle2, GraduationCap, Layers3, FileImage } from 'lucide-react';
import { DefenseMessage, PremiumData } from '@/types';
import html2canvas from 'html2canvas';
import { useMemo, useRef, useState } from 'react';
import { ChatDefense } from './ChatDefense';
import { InteractiveImagePreview } from './InteractiveImagePreview';

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
  handlePreserveAnalysis?: () => void;
  previousProject: {
    imageBase64?: string;
    mimeType?: string;
    pagePreviews?: string[];
  } | null;
  handleShareToCommunity?: () => void;
}

type DisplayPage = {
  page: number;
  pageLabel: string;
  previewUrl: string;
  mimeType: string;
  sourceName?: string;
};

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
    const language = useLanguage();

  const pages = useMemo<DisplayPage[]>(() => {
    if (premiumData.pages && premiumData.pages.length > 0) {
      return premiumData.pages.map((entry, index) => ({
        page: entry.page || index + 1,
        pageLabel: entry.pageLabel || `Pafta ${entry.page || index + 1}`,
        previewUrl: entry.previewUrl,
        mimeType: entry.mimeType,
        sourceName: entry.sourceName,
      }));
    }

    if (previewUrl) {
      return [
        {
          page: 1,
          pageLabel: 'Pafta 1',
          previewUrl,
          mimeType: mimeType ?? 'image/jpeg',
        },
      ];
    }

    return [];
  }, [premiumData.pages, previewUrl, mimeType]);

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
  const previousPreview =
    previousProject?.pagePreviews?.[activePageIndex] ??
    previousProject?.imageBase64 ??
    null;

  const handleExport = async (scale = 1) => {
    if (!exportRef.current) return;

    try {
      const canvas = await html2canvas(exportRef.current, { backgroundColor: '#0A0F1A', scale });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `draw-or-die-kirmizi-kalem-pafta-${activePage}${scale > 1 ? '-high' : ''}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
      alert(pickLocalized(language, 'Dışa aktarma başarısız oldu.', 'Export failed.'));
    }
  };

  return (
    <motion.div
      key="premium"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8"
    >
      <div className="flex flex-col gap-4 lg:sticky lg:top-24 h-fit">
        <div className="flex justify-between items-center mb-0">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide flex items-center gap-2 text-neon-red">
            <PenTool /> Kırmızı Kalem Revizyonu
          </h2>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={handlePreserveAnalysis}
              disabled={!handlePreserveAnalysis}
              className="p-2 border border-emerald-400/40 rounded-lg hover:bg-emerald-500/10 transition-colors text-emerald-100 flex items-center gap-2"
              title={pickLocalized(language, 'Analizi Koru', 'Preserve analysis')}
            >
              <span className="font-bold text-xs uppercase tracking-wider">{pickLocalized(language, 'Analizi Koru', 'Preserve')}</span>
              <span className="text-[10px] font-mono opacity-80">1.5 Rapido</span>
            </button>
            <button
              onClick={handleShareToCommunity}
              disabled={!handleShareToCommunity}
              className="p-2 border border-cyan-400/40 rounded-lg hover:bg-cyan-500/10 transition-colors text-cyan-100 flex items-center gap-2 disabled:opacity-50"
              title={pickLocalized(language, 'Community\'de paylaş', 'Share to community')}
            >
              <span className="font-bold text-xs uppercase tracking-wider">Community</span>
            </button>
            <button
              onClick={() => void handleExport()}
              className="p-2 border border-white/20 rounded-lg hover:bg-white/10 transition-colors text-slate-300 flex items-center gap-2"
              title={pickLocalized(language, 'Roast\'ı İndir', 'Download roast')}
            >
              <span className="font-bold text-xs uppercase tracking-wider">{pickLocalized(language, 'İndir', 'Download')}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            <button
              onClick={() => void handleExport(2)}
              className="p-2 border border-cyan-400/30 rounded-lg hover:bg-cyan-500/10 transition-colors text-cyan-200 flex items-center gap-2"
              title={pickLocalized(language, 'Yüksek boyutlu kaydet', 'Save high resolution')}
            >
              <span className="font-bold text-xs uppercase tracking-wider">{pickLocalized(language, 'Yüksek Kaydet', 'High Save')}</span>
              <span className="text-[10px] font-mono opacity-70">1.5 Rapido</span>
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111827] px-3 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-300">
            <Layers3 size={14} className="text-cyan-300" />
            {activePageEntry?.pageLabel ?? 'Pafta'}
            {activePageEntry?.sourceName ? <span className="text-slate-500">({activePageEntry.sourceName})</span> : null}
          </div>
          {previousProject && (
            <button
              onClick={() => setShowCompare((prev) => !prev)}
              className="bg-black/80 text-white px-3 py-1.5 rounded-full font-mono text-[10px] tracking-wider border border-white/20 hover:border-yellow-500 transition-colors"
            >
              {showCompare ? 'Karşılaştırmayı Kapat' : 'Önceki Hali ile Karşılaştır'}
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
                <span className="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded">Revize Edilmiş</span>
              </div>
            </div>
          ) : currentPreview ? (
            <InteractiveImagePreview
              src={currentPreview}
              alt={`Pafta ${activePageEntry?.page ?? 1}`}
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
                    .map(({ flaw, index }) => (
                      <div
                        key={`${index}-${flaw.reason}`}
                        onClick={() => setSelectedFlawIndex(selectedFlawIndex === index ? null : index)}
                        className={`pointer-events-auto absolute border-2 transition-all flex items-center justify-center group ${selectedFlawIndex === index ? 'border-yellow-400 bg-yellow-400/20 z-20 scale-105 shadow-[0_0_15px_rgba(250,204,21,0.5)] cursor-default' : 'border-neon-red bg-neon-red/10 hover:bg-neon-red/30 z-10 cursor-pointer'}`}
                        style={{
                          left: `${flaw.x}%`,
                          top: `${flaw.y}%`,
                          width: `${flaw.width}%`,
                          height: `${flaw.height}%`,
                        }}
                      >
                        <span className={`absolute -top-3 -right-3 w-6 h-6 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-lg transition-colors ${selectedFlawIndex === index ? 'bg-yellow-500' : 'bg-neon-red'}`}>
                          {index + 1}
                        </span>

                        {selectedFlawIndex === index && (
                          <div className="pointer-events-auto absolute top-full mt-2 left-1/2 -translate-x-1/2 w-48 sm:w-72 bg-black border border-yellow-500 p-3 text-sm text-white z-30 shadow-2xl rounded-lg cursor-auto">
                            <div className="flex justify-between items-start mb-1 gap-2">
                              <span className="font-bold text-yellow-500">Sorun #{index + 1}</span>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedFlawIndex(null); }} className="text-slate-400 hover:text-white p-1 -m-1">
                                <X size={14} />
                              </button>
                            </div>
                            <p>{flaw.reason}</p>
                            {flaw.drawingGuide ? <p className="mt-2 text-xs text-yellow-100">Çizim yönlendirmesi: {flaw.drawingGuide}</p> : null}
                          </div>
                        )}

                        {selectedFlawIndex !== index && (
                          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-black border border-neon-red p-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            {flaw.reason}
                          </div>
                        )}
                      </div>
                    ))}
                </>
              }
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-sm">
              Önizleme bulunamadı.
            </div>
          )}
        </div>

        {pages.length > 1 && (
          <div className="rounded-xl border border-white/10 bg-[#111827] p-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400 mb-2">Analiz Paftaları</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {pages.map((page) => {
                const selected = page.page === activePageEntry?.page;
                return (
                  <button
                    key={`page-${page.page}`}
                    type="button"
                    onClick={() => {
                      setSelectedFlawIndex(null);
                      setManualActivePage(page.page);
                    }}
                    className={`min-w-[140px] rounded-lg border px-3 py-2 text-left transition-colors ${selected ? 'border-neon-red bg-neon-red/10 text-white' : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/30'}`}
                  >
                    <p className="text-[10px] font-mono uppercase tracking-widest">{page.pageLabel}</p>
                    <p className="mt-1 text-xs truncate">{page.sourceName ?? 'Studio Desk Dosyası'}</p>
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
              <FileImage size={16} className="text-cyan-300" /> Pafta Özeti
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-line text-slate-300">{premiumData.summary}</p>
          </div>
        )}

        <div className="bg-[#111827] border border-white/10 rounded-xl p-6">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
            <ShieldAlert size={16} className="text-neon-red" /> Tespit Edilen Kritik Hatalar
          </h3>
          <ul className="space-y-3">
            {flawRows.map(({ flaw, index }) => {
              const selected = selectedFlawIndex === index;
              return (
                <li
                  key={`${index}-${flaw.reason}`}
                  onClick={() => {
                    setSelectedFlawIndex(selected ? null : index);
                    if (flaw.page) setManualActivePage(flaw.page);
                  }}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${selected ? 'bg-yellow-500/10 border-yellow-500/30 text-white' : 'bg-white/5 border-transparent text-slate-300 hover:bg-white/10'}`}
                >
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${selected ? 'bg-yellow-500 text-black' : 'bg-neon-red text-white'}`}>
                    {index + 1}
                  </span>
                  <span className="leading-relaxed text-sm">
                    {flaw.reason}
                    {flaw.page ? <span className="block text-[11px] text-slate-400 mt-1">{flaw.pageLabel || `Pafta ${flaw.page}`}</span> : null}
                    {flaw.drawingGuide ? <span className="block text-[11px] text-yellow-100 mt-1">Çizim: {flaw.drawingGuide}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="bg-[#111827] border border-white/10 rounded-xl p-6">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2 mb-4 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" /> Pratik Çözüm Raporu
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
              <Layers3 size={16} className="text-amber-400" /> Çizim Yönlendirmeleri
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

        <div className="bg-gradient-to-br from-[#111827] to-[#1a2333] border border-white/10 rounded-xl p-6">
          <h3 className="font-mono text-sm uppercase tracking-widest text-slate-400 border-b border-white/10 pb-2 mb-4">
            Referans Yönlendirmesi
          </h3>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
              <GraduationCap size={24} className="text-slate-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white mb-1">{premiumData.reference}</p>
              <p className="text-sm text-slate-400">Bu projeyi kurtarmak için bu referansı detaylıca incelemelisin.</p>
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

        <button
          onClick={handleNewProject}
          className="mt-6 w-full py-4 font-bold uppercase tracking-wider bg-white text-black hover:bg-slate-200 transition-colors"
        >
          Yeni Proje Yükle
        </button>
      </div>
    </motion.div>
  );
}
