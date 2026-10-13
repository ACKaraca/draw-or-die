import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Crown,
    AlertTriangle,
    RefreshCw,
    TrendingUp,
    Lightbulb,
    Route,
    Download,
    Loader2,
    Sparkles,
} from 'lucide-react';
import Markdown from 'react-markdown';

import { ChatDefense } from '@/components/ChatDefense';
import { CommunityShareButton, type CommunityShareOptions } from '@/components/CommunityShareButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InteractiveImagePreview } from '@/components/InteractiveImagePreview';
import { NewProjectButton } from '@/components/NewProjectButton';
import { PreserveAnalysisButton } from '@/components/PreserveAnalysisButton';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { SimplePdfPreview } from '@/components/SimplePdfPreview';
import { APPENDED_SECTION_PREFIX } from '@/hooks/useAnalysis';
import { isDesignInsightOperation, type DesignInsightOperation } from '@/lib/design-insights';
import { pickLocalized } from '@/lib/i18n';
import { analysisKindLabel } from '@/lib/locales/analysisKindLabels';
import { RAPIDO_COSTS, TIER_DEFAULTS } from '@/lib/pricing';

import type { FormData, DefenseMessage, GalleryPlacementType } from '@/types';

type PreviousProjectSnapshot = {
    imageBase64: string;
    mimeType: string;
    critique?: string;
};

type ReportSection = {
    heading: string;
    body: string;
};

const APPENDED_SECTION_MARKER = `\n---\n\n${APPENDED_SECTION_PREFIX}`;

/** Supplementary outputs (concept text, skill roadmap) are appended below the report by useAnalysis. */
function splitReportSections(critique: string): { main: string; sections: ReportSection[] } {
    const [main = '', ...rest] = critique.replace(/\r\n/g, '\n').split(APPENDED_SECTION_MARKER);
    const sections = rest.map((chunk) => {
        const newlineIndex = chunk.indexOf('\n');
        return {
            heading: (newlineIndex === -1 ? chunk : chunk.slice(0, newlineIndex)).trim(),
            body: newlineIndex === -1 ? '' : chunk.slice(newlineIndex + 1).trim(),
        };
    });
    return { main: main.trim(), sections };
}

/** previousProject stores raw base64 without a data: prefix. */
function toImageSource(value: string, mimeType: string | undefined): string {
    if (/^(data:|blob:|https?:)/i.test(value)) return value;
    const safeMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
    return `data:${safeMime};base64,${value}`;
}

interface ResultStepProps {
    previewUrl: string | null;
    mimeType: string | null;
    handleNewProject: () => void;
    handleRevision: () => void;
    previousProject: PreviousProjectSnapshot | null;
    critique: string | null;
    lastProgression: number | null;
    formData: FormData;
    isPremiumUser: boolean;
    galleryConsent: boolean | null;
    galleryPlacement: GalleryPlacementType;
    handleGalleryConsent: (val: boolean) => Promise<boolean> | void;
    handlePremium: () => Promise<void> | void;
    isDefending: boolean;
    setIsDefending: (val: boolean) => void;
    defenseTurnCount: number;
    defenseMessages: DefenseMessage[];
    isDefenseLoading: boolean;
    defenseInput: string;
    setDefenseInput: (val: string) => void;
    handleDefenseSubmit: () => void;
    // P0.3: Guest mode upgrade prompt
    isAnonymous: boolean;
    guestDrawingCount: number;
    showGuestUpgradePrompt: boolean;
    setShowGuestUpgradePrompt: (val: boolean) => void;
    setGuestDrawingCount: (val: number) => void;
    onUpgradeClick: () => void;
    /** Opens the sign-up / sign-in modal (guests are routed here, not to the Premium shop). */
    onAuthRequired?: () => void;
    handlePreserveAnalysis?: () => Promise<boolean> | void;
    handleShareToCommunity?: (options: CommunityShareOptions) => Promise<boolean> | void;
    handleAutoConcept?: () => void;
    latestAnalysisKind: string | null;
    handleDesignInsight: (operation: DesignInsightOperation) => void;
}

export function ResultStep({
    previewUrl, mimeType, handleNewProject, handleRevision, previousProject,
    critique, lastProgression, formData, isPremiumUser, galleryConsent, galleryPlacement,
    handleGalleryConsent, handlePremium, isDefending, setIsDefending, defenseTurnCount,
    defenseMessages, isDefenseLoading, defenseInput, setDefenseInput, handleDefenseSubmit,
    // P0.3
    isAnonymous, guestDrawingCount, showGuestUpgradePrompt, setShowGuestUpgradePrompt, setGuestDrawingCount, onUpgradeClick,
    onAuthRequired,
    handlePreserveAnalysis,
    handleShareToCommunity,
    handleAutoConcept,
    latestAnalysisKind,
    handleDesignInsight,
}: ResultStepProps) {
    const language = useLanguage();
    const [exportError, setExportError] = useState<string | null>(null);
    const exportRef = useRef<HTMLDivElement>(null);
    const [showCompare, setShowCompare] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isRescueStarting, setIsRescueStarting] = useState(false);
    const [pendingGalleryConsent, setPendingGalleryConsent] = useState<boolean | null>(null);
    const normalizedAnalysisKind = (latestAnalysisKind ?? 'SINGLE_JURY').toUpperCase();
    const isFocusedReport = isDesignInsightOperation(normalizedAnalysisKind);
    const reportTitle = isFocusedReport
        ? analysisKindLabel(normalizedAnalysisKind, language)
        : pickLocalized(language, 'Jüri Raporu', 'Jury Report');
    const { main: mainCritique, sections: reportSections } = splitReportSections(critique ?? '');
    const hasReportSection = (kind: string) =>
        reportSections.some(
            (section) => section.heading === analysisKindLabel(kind, 'tr') || section.heading === analysisKindLabel(kind, 'en'),
        );
    const hasSkillRoadmap = normalizedAnalysisKind === 'SKILL_ROADMAP' || hasReportSection('SKILL_ROADMAP');
    const hasConceptText = hasReportSection('AUTO_CONCEPT');
    // previousProject equals the current board after a fresh jury run; only a revision has a real "before".
    const canCompare = Boolean(previousProject?.imageBase64) && normalizedAnalysisKind === 'REVISION_SAME';
    const isComparing = showCompare && canCompare;

    // P0.3: Track guest completion on first result view
    const isGuestFirstCompletion = !isFocusedReport && isAnonymous && !isPremiumUser && guestDrawingCount === 0;
    
    useEffect(() => {
        if (isGuestFirstCompletion) {
            setGuestDrawingCount(1);
            setShowGuestUpgradePrompt(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGuestFirstCompletion]);

    const handleExport = async () => {
        if (!exportRef.current || isExporting) return;
        setIsExporting(true);
        setExportError(null);
        try {
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(exportRef.current, { backgroundColor: '#0A0F1A' });
            const dataUrl = canvas.toDataURL('image/png');
            if (!dataUrl.startsWith('data:image/')) {
                throw new Error('Security check failed: Invalid data URL');
            }
            const link = document.createElement('a');
            link.download = `draw-or-die-${normalizedAnalysisKind.toLowerCase()}.png`;
            link.href = dataUrl;
            link.click();
        } catch {
            setExportError(
                pickLocalized(
                    language,
                    'Rapor görseli oluşturulamadı. Sayfayı yenileyip indirmeyi tekrar dene.',
                    'The report image could not be created. Refresh the page and try the download again.',
                ),
            );
        } finally {
            setIsExporting(false);
        }
    };

    const startPremiumRescue = async () => {
        if (isRescueStarting) return;
        setIsRescueStarting(true);
        try {
            await handlePremium();
        } finally {
            setIsRescueStarting(false);
        }
    };

    const submitGalleryConsent = async (consent: boolean) => {
        if (pendingGalleryConsent !== null) return;
        setPendingGalleryConsent(consent);
        try {
            await handleGalleryConsent(consent);
        } finally {
            setPendingGalleryConsent(null);
        }
    };

    return (
        <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl grid grid-cols-1 xl:grid-cols-12 gap-5 md:gap-8 relative"
        >
            {/* P0.3: Guest sign-up prompt after the first completed drawing */}
            <ConfirmDialog
                isOpen={showGuestUpgradePrompt}
                title={pickLocalized(language, 'Harika iş!', 'Great work!')}
                description={pickLocalized(
                    language,
                    'Jüri raporun hazır. Ücretsiz hesap oluşturarak çalışmalarını saklayabilir ve daha fazla pafta gönderebilirsin.',
                    'Your jury report is ready. Create a free account to keep your work and submit more boards.',
                )}
                icon={<Sparkles size={18} strokeWidth={1.5} />}
                confirmLabel={pickLocalized(language, 'Hesap Oluştur', 'Create account')}
                cancelLabel={pickLocalized(language, 'Belki Sonra', 'Maybe later')}
                onConfirm={() => {
                    setShowGuestUpgradePrompt(false);
                    (onAuthRequired ?? onUpgradeClick)();
                }}
                onCancel={() => setShowGuestUpgradePrompt(false)}
            >
                <div className="rounded-lg border border-white/[0.08] bg-bg-2 p-4">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                        {pickLocalized(language, 'Hesap avantajları', 'Account benefits')}
                    </p>
                    <ul className="space-y-1 font-sans text-sm text-text">
                        <li>
                            ✓{' '}
                            {pickLocalized(
                                language,
                                `${TIER_DEFAULTS.REGISTERED} Rapido başlangıç bakiyesi`,
                                `${TIER_DEFAULTS.REGISTERED} Rapido starting balance`,
                            )}
                        </li>
                        <li>✓ {pickLocalized(language, 'Daha fazla jüri gönderimi', 'More jury submissions')}</li>
                        <li>✓ {pickLocalized(language, 'Orta uzunlukta jüri raporları', 'Medium-length jury reports')}</li>
                    </ul>
                </div>
            </ConfirmDialog>

            {/* Left: Image */}
            <div className="xl:col-span-5 flex flex-col gap-4">
                <div className="relative aspect-[4/5] sm:aspect-[3/4] w-full bg-black/50 border border-white/10 rounded-xl overflow-hidden">
                    {isComparing && previousProject ? (
                        <div className="absolute inset-0 flex border-4 border-neon-red/30">
                            <div className="w-1/2 h-full border-r border-neon-red relative overflow-hidden">
                                {previousProject.mimeType === 'application/pdf' ? (
                                    <div className="w-full h-full flex items-center justify-center p-4 text-center text-slate-500 font-mono text-xs">{pickLocalized(language, 'PDF önizleme karşılaştırması desteklenmiyor', 'PDF preview comparison is not supported')}</div>
                                ) : (
                                    <img src={toImageSource(previousProject.imageBase64, previousProject.mimeType)} alt={pickLocalized(language, 'Önce', 'Before')} className="absolute top-0 left-0 w-[200%] max-w-none h-full object-contain object-left pointer-events-none" />
                                )}
                                <span className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 font-mono text-[10px] font-bold tracking-widest uppercase rounded">{pickLocalized(language, 'Önce', 'Before')}</span>
                            </div>
                            <div className="w-1/2 h-full relative overflow-hidden">
                                {previewUrl && (mimeType === 'application/pdf' ? (
                                    <SimplePdfPreview
                                        src={previewUrl}
                                        className="h-full w-full"
                                        showControls={false}
                                    />
                                ) : (
                                    <img src={previewUrl} alt={pickLocalized(language, 'Sonra', 'After')} className="absolute top-0 right-0 w-[200%] max-w-none h-full object-contain object-right pointer-events-none" />
                                ))}
                                <span className="absolute top-2 right-2 bg-neon-red text-white px-2 py-1 font-mono text-[10px] font-bold tracking-widest uppercase rounded">{pickLocalized(language, 'Sonra', 'After')}</span>
                            </div>
                        </div>
                    ) : (
                        previewUrl && (
                            mimeType === 'application/pdf' ? (
                                <SimplePdfPreview src={previewUrl} className="h-full w-full" />
                            ) : (
                                <InteractiveImagePreview
                                    src={previewUrl}
                                    alt={pickLocalized(language, 'Yüklenen pafta', 'Uploaded board')}
                                    className="h-full w-full"
                                    showControls={false}
                                />
                            )
                        )
                    )}

                    {canCompare && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                            <button
                                type="button"
                                onClick={() => setShowCompare((prev) => !prev)}
                                aria-pressed={isComparing}
                                className="bg-black/80 text-white px-4 py-2 rounded-full font-mono text-xs tracking-wider border border-white/20 hover:border-neon-red focus-visible:border-neon-red focus-visible:outline-none transition-colors"
                            >
                                {isComparing
                                  ? pickLocalized(language, 'Karşılaştırmayı Kapat', 'Close comparison')
                                  : pickLocalized(language, 'Evrim Görünümü (Önce/Sonra)', 'Evolution view (before/after)')}
                            </button>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    <PreserveAnalysisButton
                        onPreserve={handlePreserveAnalysis}
                        className="min-h-12 inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-100 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    {!isFocusedReport && (
                        <CommunityShareButton
                            onShare={handleShareToCommunity}
                            className="min-h-12 inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-100 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    )}
                    {!isFocusedReport && handleAutoConcept && !hasConceptText && (
                        <button
                            type="button"
                            onClick={handleAutoConcept}
                            className="min-h-12 inline-flex items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/10 px-3 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-sky-100 transition-colors hover:bg-sky-500/20"
                            title={pickLocalized(language, 'Projen için jüriye hazır bir konsept metni üret; raporun korunur', 'Generate a jury-ready concept text for your project; your report is kept')}
                        >
                            <Lightbulb size={16} strokeWidth={1.5} aria-hidden="true" />
                            {pickLocalized(language, 'Konsept Metni Yaz', 'Write concept text')}{' '}
                            <span className="font-normal opacity-60">({RAPIDO_COSTS.AUTO_CONCEPT} Rapido)</span>
                        </button>
                    )}
                    <NewProjectButton
                        onConfirm={handleNewProject}
                        className="min-h-12 inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-slate-200 transition-colors hover:bg-white/5"
                    >
                        <RefreshCw size={16} strokeWidth={1.5} aria-hidden="true" /> {pickLocalized(language, 'Yeni Proje', 'New Project')}
                    </NewProjectButton>
                    {!hasSkillRoadmap && (
                        <button
                            type="button"
                            onClick={() => handleDesignInsight('SKILL_ROADMAP')}
                            className="min-h-12 inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-cyan-100 transition-colors hover:bg-cyan-500/20"
                        >
                            <Route size={16} strokeWidth={1.5} aria-hidden="true" />
                            {pickLocalized(language, 'Beceri Rotamı Oluştur', 'Build My Skill Roadmap')}{' '}
                            <span className="font-normal text-neon-red">({RAPIDO_COSTS.SKILL_ROADMAP} Rapido)</span>
                        </button>
                    )}
                    {!isFocusedReport && previousProject && (
                        <button
                            type="button"
                            onClick={handleRevision}
                            className="min-h-12 inline-flex items-center justify-center gap-2 rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-3 text-center font-mono text-[11px] font-bold uppercase tracking-wider text-neon-red transition-colors hover:bg-neon-red/20"
                        >
                            <TrendingUp size={16} strokeWidth={1.5} aria-hidden="true" /> {pickLocalized(language, 'Revizyon Yükle', 'Upload Revision')}
                        </button>
                    )}
                </div>
            </div>

            {/* Right: Critique */}
            <div className="xl:col-span-7 flex flex-col">
                {exportError ? (
                  <div role="alert" className="mb-4 rounded-lg border border-red-500/25 bg-red-500/8 p-4">
                    <p className="font-mono text-[11px] uppercase tracking-wider text-red-300">
                      {pickLocalized(language, 'Dışa aktarma başarısız', 'Export failed')}
                    </p>
                    <p className="mt-1 text-sm text-red-200">{exportError}</p>
                  </div>
                ) : null}
                <div ref={exportRef} className="bg-[#111827] border border-neon-red/30 rounded-xl p-4 sm:p-8 shadow-2xl relative overflow-hidden flex-1">
                    <div className="absolute top-0 left-0 w-1 h-full bg-neon-red"></div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 border-b border-white/10 pb-4">
                        <AlertTriangle className="text-neon-red" size={28} />
                        <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-white">{reportTitle}</h2>
                        {lastProgression !== null && (
                            <span className="ml-4 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs font-mono text-emerald-400 flex items-center gap-1">
                                <TrendingUp size={14} /> +{lastProgression} {pickLocalized(language, 'Gelişim', 'Progression')}
                            </span>
                        )}
                        {!isFocusedReport && (
                            <span className="ml-auto px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-slate-400">
                                {pickLocalized(language, 'Sertlik', 'Harshness')}: {formData.harshness}/5
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => void handleExport()}
                            disabled={isExporting}
                            aria-busy={isExporting}
                            className="ml-2 hover:bg-white/10 p-2 rounded transition-colors text-slate-400 hover:text-white disabled:cursor-wait disabled:opacity-60"
                            title={pickLocalized(language, 'Raporu PNG olarak indir', 'Download report as PNG')}
                            aria-label={pickLocalized(language, 'Raporu PNG olarak indir', 'Download report as PNG')}
                        >
                            {isExporting ? (
                                <Loader2 size={16} strokeWidth={1.5} className="animate-spin" aria-hidden="true" />
                            ) : (
                                <Download size={16} strokeWidth={1.5} aria-hidden="true" />
                            )}
                        </button>
                    </div>

                    {normalizedAnalysisKind === 'ACCESSIBILITY_EGRESS' && (
                        <div className="mb-4 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 font-mono text-[11px] leading-relaxed text-cyan-100">
                            {pickLocalized(
                                language,
                                'Bu çıktı yalnızca görsel ön kontroldür; resmî mevzuat uygunluk belgesi değildir.',
                                'This is a visual pre-check only; it is not an official code-compliance certification.',
                            )}
                        </div>
                    )}

                    <div className="prose prose-invert prose-slate max-w-none font-sans text-slate-300 overflow-y-auto max-h-[42vh] sm:max-h-[500px] pr-2 sm:pr-4 custom-scrollbar">
                        <Markdown>{mainCritique}</Markdown>
                    </div>

                    {reportSections.map((section, index) => (
                        <section
                            key={`${section.heading}-${index}`}
                            className="mt-6 rounded-xl border border-white/[0.08] bg-bg-2 p-5"
                            aria-label={section.heading}
                        >
                            <h3 className="section-divider">
                                <span aria-hidden="true">◈</span>
                                {section.heading}
                            </h3>
                            <div className="prose prose-invert prose-slate max-w-none font-sans text-slate-300 overflow-y-auto max-h-[42vh] pr-2 custom-scrollbar">
                                <Markdown>{section.body}</Markdown>
                            </div>
                        </section>
                    ))}

                    {/* Gallery Consent — explicit opt-in for every tier; nothing is published without it */}
                    {galleryPlacement !== 'NONE' && (
                        <div className={`mt-8 border rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${galleryPlacement === 'HALL_OF_FAME' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-neon-red/10 border-neon-red/30'}`}>
                            <div>
                                <h3 className={`font-display font-bold text-xl flex items-center gap-2 mb-1 ${galleryPlacement === 'HALL_OF_FAME' ? 'text-emerald-500' : 'text-neon-red'}`}>
                                    {galleryPlacement === 'HALL_OF_FAME' ? <Crown size={20} strokeWidth={1.5} /> : <AlertTriangle size={20} strokeWidth={1.5} />}
                                    {galleryPlacement === 'HALL_OF_FAME'
                                      ? pickLocalized(language, 'Hall of Fame Adayı!', 'Hall of Fame nominee!')
                                      : pickLocalized(language, 'Wall of Death Adayı!', 'Wall of Death nominee!')}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    {galleryPlacement === 'HALL_OF_FAME'
                                      ? pickLocalized(
                                          language,
                                          'Jüri bu projeyi başarısından dolayı Hall of Fame galerisine önerdi.',
                                          'The jury nominated this project for the Hall of Fame gallery.',
                                        )
                                      : pickLocalized(
                                          language,
                                          'Jüri bu projeyi ibret olması için Wall of Death galerisine önerdi.',
                                          'The jury nominated this project for the Wall of Death gallery.',
                                        )}{' '}
                                    {pickLocalized(
                                        language,
                                        'İzin verirsen paftan ve jüri yorumunun bir bölümü herkese açık galeride sergilenir; vermezsen gizli kalır.',
                                        'If you allow it, your board and an excerpt of the jury comment are shown in the public gallery; otherwise it stays private.',
                                    )}
                                </p>
                            </div>

                            <div className="flex-shrink-0">
                                {galleryConsent === null ? (
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => void submitGalleryConsent(true)}
                                            disabled={pendingGalleryConsent !== null}
                                            aria-busy={pendingGalleryConsent === true}
                                            className="inline-flex items-center gap-2 rounded-lg border border-white/[0.13] bg-white/5 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {pendingGalleryConsent === true ? (
                                                <Loader2 size={14} strokeWidth={1.5} className="animate-spin" aria-hidden="true" />
                                            ) : null}
                                            {pickLocalized(language, 'İzin Ver', 'Allow')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void submitGalleryConsent(false)}
                                            disabled={pendingGalleryConsent !== null}
                                            className="rounded-lg px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-text-muted transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {pickLocalized(language, 'Gizli Tut', 'Keep private')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-right">
                                        <span className="text-sm font-bold text-white">
                                            {galleryConsent
                                              ? pickLocalized(language, 'Sergilenmesine İzin Verildi', 'Allowed for display')
                                              : pickLocalized(language, 'Gizli Tutuldu', 'Kept private')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Defense UI */}
                {!isFocusedReport && (
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
                )}

                {/* Premium Upsell */}
                {!isFocusedReport && <div className="mt-6 rounded-xl border border-neon-red/30 bg-neon-red/10 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-display font-bold text-xl text-white flex items-center gap-2 mb-1">
                            <Crown className="text-yellow-500" size={20} strokeWidth={1.5} /> {pickLocalized(language, 'Projeyi Kurtar (Premium)', 'Rescue the project (Premium)')}
                        </h3>
                        <p className="text-sm text-slate-400">
                            {pickLocalized(
                                language,
                                'Kırmızı kalem revizyonu, referanslar ve pratik çözümler al.',
                                'Get red-pen revisions, references, and practical fixes.',
                            )}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void startPremiumRescue()}
                        disabled={isRescueStarting}
                        aria-busy={isRescueStarting}
                        className="min-h-12 inline-flex items-center justify-center gap-2 rounded-none px-6 py-3 bg-neon-red text-white font-mono font-bold uppercase tracking-wider text-xs shadow-[0_0_24px_rgba(255,0,51,0.35)] transition-colors hover:bg-neon-red/90 disabled:cursor-wait disabled:opacity-70 disabled:shadow-none"
                    >
                        {isRescueStarting ? (
                            <>
                                <Loader2 size={14} strokeWidth={1.5} className="animate-spin" aria-hidden="true" />
                                {pickLocalized(language, 'Paftalar hazırlanıyor…', 'Preparing sheets…')}
                            </>
                        ) : (
                            <>
                                {pickLocalized(language, 'Kilidi Aç', 'Unlock')}{' '}
                                <span className="font-normal opacity-60">({RAPIDO_COSTS.PREMIUM_RESCUE} Rapido)</span>
                            </>
                        )}
                    </button>
                </div>}
            </div>
        </motion.div>
    );
}
