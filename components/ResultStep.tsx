import { useLanguage } from "@/components/RuntimeTextLocalizer";
import { pickLocalized } from "@/lib/i18n";
import { motion } from 'framer-motion';
import { Crown, AlertTriangle, RefreshCw, TrendingUp, Lightbulb } from 'lucide-react';
import Markdown from 'react-markdown';
import html2canvas from 'html2canvas';
import { useRef, useState, useEffect } from 'react';
import { ChatDefense } from './ChatDefense';
import { SimplePdfPreview } from './SimplePdfPreview';
import { InteractiveImagePreview } from './InteractiveImagePreview';
import { FormData, DefenseMessage, GalleryPlacementType } from '@/types';
import { RAPIDO_COSTS } from '@/lib/pricing';

interface ResultStepProps {
    previewUrl: string | null;
    mimeType: string | null;
    handleNewProject: () => void;
    handleRevision: () => void;
    previousProject: any;
    critique: string | null;
    lastProgression: number | null;
    formData: FormData;
    isPremiumUser: boolean;
    galleryConsent: boolean | null;
    galleryPlacement: GalleryPlacementType;
    handleGalleryConsent: (val: boolean) => void;
    handlePremium: () => void;
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
    handlePreserveAnalysis?: () => void;
    handleShareToCommunity?: () => void;
    handleAutoConcept?: () => void;
}

export function ResultStep({
    previewUrl, mimeType, handleNewProject, handleRevision, previousProject,
    critique, lastProgression, formData, isPremiumUser, galleryConsent, galleryPlacement,
    handleGalleryConsent, handlePremium, isDefending, setIsDefending, defenseTurnCount,
    defenseMessages, isDefenseLoading, defenseInput, setDefenseInput, handleDefenseSubmit,
    // P0.3
    isAnonymous, guestDrawingCount, showGuestUpgradePrompt, setShowGuestUpgradePrompt, setGuestDrawingCount, onUpgradeClick,
    handlePreserveAnalysis,
    handleShareToCommunity,
    handleAutoConcept,
}: ResultStepProps) {
    const language = useLanguage();
    const exportRef = useRef<HTMLDivElement>(null);
    const [showCompare, setShowCompare] = useState(false);

    // P0.3: Track guest completion on first result view
    const isGuestFirstCompletion = isAnonymous && !isPremiumUser && guestDrawingCount === 0;
    
    useEffect(() => {
        if (isGuestFirstCompletion) {
            setGuestDrawingCount(1);
            setShowGuestUpgradePrompt(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGuestFirstCompletion]);

    const handleExport = async () => {
        if (exportRef.current) {
            try {
                const canvas = await html2canvas(exportRef.current, { backgroundColor: '#0A0F1A' });
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = 'draw-or-die-roast.png';
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error("Export failed", err);
                alert(pickLocalized(language, 'Dışa aktarma başarısız oldu.', 'Export failed.'));
            }
        }
    };

    return (
        <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-6xl grid grid-cols-1 xl:grid-cols-12 gap-5 md:gap-8 relative"
        >
            {/* P0.3: Guest upgrade prompt overlay */}
            {showGuestUpgradePrompt && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setShowGuestUpgradePrompt(false)}
                >
                    <div
                        className="bg-gradient-to-b from-slate-900/95 to-slate-950/95 border border-amber-500/30 rounded-2xl shadow-2xl max-w-sm p-8 text-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 text-4xl">🎨</div>
                        <h2 className="font-display text-2xl font-bold mb-3 text-white">
                            {pickLocalized(language, 'Harika iş!', 'Great work!')}
                        </h2>
                        <p className="text-slate-300 mb-6 text-sm leading-relaxed">
                            {pickLocalized(
                                language,
                                'Çizimin tamamlandı ve jüriye hazır. Kayıt olarak çalışmalarını saklayıp daha fazla gönderi yapabilirsin.',
                                'Your design is complete and ready for the jury. Create an account to save your work and submit more designs.',
                            )}
                        </p>
                        
                        <div className="space-y-2 mb-6 text-left bg-slate-800/50 rounded-lg p-4">
                            <p className="text-xs text-slate-400 font-mono uppercase tracking-widest mb-2">
                                {pickLocalized(language, 'Premium avantajları', 'Premium benefits')}
                            </p>
                            <ul className="text-sm text-slate-300 space-y-1">
                                <li>✓ {pickLocalized(language, 'Sınırsız tasarım kaydı', 'Save unlimited designs')}</li>
                                <li>✓ {pickLocalized(language, 'Birden fazla jüri eleştirisi', 'Multiple jury critiques')}</li>
                                <li>✓ {pickLocalized(language, 'Jüri savunma sohbeti', 'Jury defense chat')}</li>
                                <li>✓ {pickLocalized(language, 'AI mentor desteği', 'AI mentor assistance')}</li>
                                <li>✓ {pickLocalized(language, 'Haftalık kurtarma tokenları', 'Weekly rescue tokens')}</li>
                            </ul>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowGuestUpgradePrompt(false)}
                                className="flex-1 py-3 px-4 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-white font-mono text-sm transition-colors"
                                aria-label={pickLocalized(language, 'Kapat ve gezinmeye devam et', 'Dismiss and continue browsing')}
                            >
                                {pickLocalized(language, 'Belki sonra', 'Maybe later')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowGuestUpgradePrompt(false);
                                    onUpgradeClick();
                                }}
                                className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 rounded-lg text-black font-bold transition-colors"
                                aria-label={pickLocalized(language, 'Hesap oluştur', 'Create account to save designs')}
                            >
                                {pickLocalized(language, 'Hesap Oluştur', 'Create account')}
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Left: Image */}
            <div className="xl:col-span-5 flex flex-col gap-4">
                <div className="relative aspect-[4/5] sm:aspect-[3/4] w-full bg-black/50 border border-white/10 rounded-xl overflow-hidden group">
                    {showCompare && previousProject ? (
                        <div className="absolute inset-0 flex relative border-4 border-neon-red/30">
                            <div className="w-1/2 h-full border-r border-neon-red relative">
                                {previousProject.mimeType === 'application/pdf' ? (
                                    <div className="w-full h-full flex items-center justify-center text-slate-500 font-mono text-xs">{pickLocalized(language, 'PDF önizleme karşılaştırması desteklenmiyor', 'PDF preview comparison is not supported')}</div>
                                ) : (
                                    <img src={previousProject.imageBase64} alt={pickLocalized(language, 'Önce', 'Before')} className="absolute top-0 left-0 w-[200%] max-w-none h-full object-contain object-left pointer-events-none" />
                                )}
                                <span className="absolute top-2 left-2 bg-black/80 text-white px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded">{pickLocalized(language, 'Önce', 'Before')}</span>
                            </div>
                            <div className="w-1/2 h-full relative overflow-hidden">
                                {mimeType === 'application/pdf' ? (
                                    <SimplePdfPreview
                                        src={previewUrl!}
                                        className="h-full w-full"
                                        showControls={false}
                                    />
                                ) : (
                                    <img src={previewUrl!} alt={pickLocalized(language, 'Sonra', 'After')} className="absolute top-0 right-0 w-[200%] max-w-none h-full object-contain object-right pointer-events-none" />
                                )}
                                <span className="absolute top-2 right-2 bg-neon-red text-white px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded">{pickLocalized(language, 'Sonra', 'After')}</span>
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

                    {previousProject && (
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => setShowCompare(!showCompare)}
                                className="bg-black/80 text-white px-4 py-2 rounded-full font-mono text-xs tracking-wider border border-white/20 hover:border-neon-red transition-colors"
                            >
                                {showCompare
                                  ? pickLocalized(language, 'Kapat', 'Close')
                                  : pickLocalized(language, 'Evrim Görünümü (Önce/Sonra)', 'Evolution view (before/after)')}
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handlePreserveAnalysis}
                        disabled={!handlePreserveAnalysis}
                        className="flex-1 flex items-center justify-center gap-2 py-3 border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-100 transition-colors text-sm font-mono uppercase"
                    >
                        {pickLocalized(language, 'Analizi Koru', 'Preserve analysis')} (1.5 Rapido)
                    </button>
                    <button
                        onClick={handleShareToCommunity}
                        disabled={!handleShareToCommunity}
                        className="flex-1 flex items-center justify-center gap-2 py-3 border border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-100 transition-colors text-sm font-mono uppercase disabled:opacity-50"
                    >
                        {pickLocalized(language, "Community'de Paylaş", 'Share on Community')}
                    </button>
                    {handleAutoConcept && (
                        <button
                            onClick={handleAutoConcept}
                            className="flex-1 flex items-center justify-center gap-2 py-3 border border-sky-400/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-100 transition-colors text-sm font-mono uppercase"
                            title={pickLocalized(language, 'Havalı felsefi konsept metni uydur', 'Spin up a philosophical concept text')}
                        >
                            <Lightbulb size={16} /> {pickLocalized(language, 'Konsept Metni Yaz', 'Write concept text')} ({RAPIDO_COSTS.AUTO_CONCEPT} Rapido)
                        </button>
                    )}
                    <button
                        onClick={handleNewProject}
                        className="flex-1 flex items-center justify-center gap-2 py-3 border border-white/20 hover:bg-white/5 transition-colors text-sm font-mono uppercase"
                    >
                        <RefreshCw size={16} /> {pickLocalized(language, 'Yeni Proje', 'New Project')}
                    </button>
                    {previousProject && (
                        <button
                            onClick={handleRevision}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-neon-red/10 border border-neon-red/30 text-neon-red hover:bg-neon-red/20 transition-colors text-sm font-mono uppercase"
                        >
                            <TrendingUp size={16} /> {pickLocalized(language, 'Revizyon Yükle', 'Upload Revision')}
                        </button>
                    )}
                </div>
            </div>

            {/* Right: Critique */}
            <div className="xl:col-span-7 flex flex-col">
                <div ref={exportRef} className="bg-[#111827] border border-neon-red/30 rounded-xl p-4 sm:p-8 shadow-2xl relative overflow-hidden flex-1">
                    <div className="absolute top-0 left-0 w-1 h-full bg-neon-red"></div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-6 border-b border-white/10 pb-4">
                        <AlertTriangle className="text-neon-red" size={28} />
                        <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-white">{pickLocalized(language, 'Jüri Raporu', 'Jury Report')}</h2>
                        {lastProgression !== null && (
                            <span className="ml-4 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs font-mono text-emerald-400 flex items-center gap-1">
                                <TrendingUp size={14} /> +{lastProgression} {pickLocalized(language, 'Gelişim', 'Progression')}
                            </span>
                        )}
                        <span className="ml-auto px-3 py-1 bg-white/5 border border-white/10 rounded text-xs font-mono text-slate-400">
                            {pickLocalized(language, 'Sertlik', 'Harshness')}: {formData.harshness}/5
                        </span>
                        <button
                            onClick={handleExport}
                            className="ml-2 hover:bg-white/10 p-2 rounded transition-colors text-slate-400 hover:text-white"
                            title={pickLocalized(language, "Roast'u İndir", 'Download roast')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                    </div>

                    <div className="prose prose-invert prose-slate max-w-none font-sans text-slate-300 overflow-y-auto max-h-[42vh] sm:max-h-[500px] pr-2 sm:pr-4 custom-scrollbar">
                        <Markdown>{critique || ''}</Markdown>
                    </div>

                    {/* Gallery Consent */}
                    {isPremiumUser && galleryConsent === null && galleryPlacement !== 'NONE' && (
                        <div className={`mt-8 border rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${galleryPlacement === 'HALL_OF_FAME' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-neon-red/10 border-neon-red/30'}`}>
                            <div>
                                <h3 className={`font-display font-bold text-xl flex items-center gap-2 mb-1 ${galleryPlacement === 'HALL_OF_FAME' ? 'text-emerald-500' : 'text-neon-red'}`}>
                                    {galleryPlacement === 'HALL_OF_FAME' ? <Crown size={20} /> : <AlertTriangle size={20} />}
                                    {galleryPlacement === 'HALL_OF_FAME'
                                      ? pickLocalized(language, 'Hall of Fame Adayı!', 'Hall of Fame nominee!')
                                      : pickLocalized(language, 'Wall of Death Adayı!', 'Wall of Death nominee!')}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    {galleryPlacement === 'HALL_OF_FAME'
                                      ? pickLocalized(
                                          language,
                                          'Jüri bu projeyi başarısından dolayı Hall of Fame galerisine eklemeyi önerdi.',
                                          'The jury recommends adding this project to the Hall of Fame gallery.',
                                        )
                                      : pickLocalized(
                                          language,
                                          'Jüri bu projeyi ibret olması için Wall of Death galerisine eklemeyi önerdi.',
                                          'The jury recommends adding this project to the Wall of Death gallery.',
                                        )}
                                </p>
                            </div>

                            <div className="flex-shrink-0">
                                {galleryConsent === null ? (
                                    <div className="flex gap-3">
                                        <button onClick={() => handleGalleryConsent(true)} className="px-4 py-2 bg-white text-black font-bold text-sm rounded hover:bg-slate-200 transition-colors">
                                            {pickLocalized(language, 'İzin Ver', 'Allow')}
                                        </button>
                                        <button onClick={() => handleGalleryConsent(false)} className="px-4 py-2 border border-white/20 text-white font-bold text-sm rounded hover:bg-white/10 transition-colors">
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

                {/* Premium Upsell */}
                <div className="mt-6 bg-gradient-to-r from-neon-red/20 to-transparent border border-neon-red/30 rounded-xl p-6 flex items-center justify-between">
                    <div>
                        <h3 className="font-display font-bold text-xl text-white flex items-center gap-2 mb-1">
                            <Crown className="text-yellow-500" size={20} /> {pickLocalized(language, 'Projeyi Kurtar (Premium)', 'Rescue the project (Premium)')}
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
                        onClick={handlePremium}
                        className="px-6 py-3 bg-neon-red hover:bg-[#cc0029] text-white font-bold uppercase tracking-wider text-sm transition-colors"
                    >
                        {pickLocalized(language, 'Kilidi Aç', 'Unlock')} ({RAPIDO_COSTS.PREMIUM_RESCUE} Rapido)
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
