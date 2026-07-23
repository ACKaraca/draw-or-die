import { useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Layers, Hammer, Frown } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { MultiPersonaData } from '@/types';
import { SimplePdfPreview } from '@/components/SimplePdfPreview';
import { InteractiveImagePreview } from '@/components/InteractiveImagePreview';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';
import { RAPIDO_COSTS } from '@/lib/pricing';

interface MultiResultStepProps {
    multiData: MultiPersonaData;
    previewUrl: string | null;
    mimeType: string | null;
    handleNewProject: () => void;
    handlePremium?: () => void;
    handlePreserveAnalysis?: () => void;
    handleShareToCommunity?: () => void;
}

export function MultiResultStep({ multiData, previewUrl, mimeType, handleNewProject, handlePremium, handlePreserveAnalysis, handleShareToCommunity }: MultiResultStepProps) {
    const language = useLanguage();
    const personas = useMemo(() => {
        if (Array.isArray(multiData.personas) && multiData.personas.length > 0) {
            return multiData.personas;
        }

        return [
            { id: 'structural', name: pickLocalized(language, 'Strüktürcü', 'Structural'), critique: multiData.structural?.critique ?? pickLocalized(language, 'Yanıt yok.', 'No answer.'), score: multiData.structural?.score ?? 0 },
            { id: 'conceptual', name: pickLocalized(language, 'Konseptüel', 'Conceptual'), critique: multiData.conceptual?.critique ?? pickLocalized(language, 'Yanıt yok.', 'No answer.'), score: multiData.conceptual?.score ?? 0 },
            { id: 'grumpy', name: pickLocalized(language, 'Huysuz Jüri', 'Grumpy jury'), critique: multiData.grumpy?.critique ?? pickLocalized(language, 'Yanıt yok.', 'No answer.'), score: multiData.grumpy?.score ?? 0 },
        ];
    }, [multiData, language]);

    const [activePersonaId, setActivePersonaId] = useState<string>(personas[0]?.id ?? 'structural');
    const effectiveActivePersonaId = personas.some((entry) => entry.id === activePersonaId)
        ? activePersonaId
        : (personas[0]?.id ?? 'structural');
    const activePersona = personas.find((entry) => entry.id === effectiveActivePersonaId) ?? personas[0];

    const visualByPersonaId: Record<string, { icon: ReactNode; color: string; bg: string; border: string }> = {
        structural: { icon: <Hammer size={18} />, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500' },
        conceptual: { icon: <Layers size={18} />, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500' },
        grumpy: { icon: <Frown size={18} />, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500' },
    };

    const getVisual = (id: string) => visualByPersonaId[id] ?? {
        icon: <Layers size={18} />,
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/10',
        border: 'border-cyan-500',
    };

    return (
        <motion.div
            key="multi-result"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="w-full max-w-6xl grid grid-cols-1 xl:grid-cols-2 gap-5 md:gap-8"
        >
            {/* Sol: Resim */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="font-display text-2xl font-bold uppercase tracking-wide flex items-center gap-2 flex-wrap">
                        <Layers className="text-purple-500" /> {pickLocalized(language, 'Çoklu Jüri Analizi', 'Multi jury analysis')}
                        {multiData.projectTitle && <span className="text-sm text-slate-300 normal-case tracking-normal">- {multiData.projectTitle}</span>}
                    </h2>
                </div>
                <div className="relative aspect-[4/5] md:aspect-square bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                    {previewUrl && (
                        mimeType === 'application/pdf' ? (
                            <SimplePdfPreview src={previewUrl} className="h-full w-full" showControls={false} />
                        ) : (
                            <InteractiveImagePreview
                                src={previewUrl}
                                alt={pickLocalized(language, 'Analiz edilmiş proje', 'Analyzed Project')}
                                className="h-full w-full"
                                showControls={false}
                            />
                        )
                    )}
                </div>
            </div>

            {/* Sağ: Tablar ve Eleştiri */}
            <div className="flex flex-col gap-4 bg-white/5 p-4 sm:p-6 rounded-xl border border-white/10 h-full max-h-[82vh] overflow-hidden">
                {/* Tabs */}
                <div className={`grid gap-2 border-b border-white/10 pb-4 ${personas.length <= 2 ? 'grid-cols-2' : personas.length === 3 ? 'grid-cols-3' : 'grid-cols-2 xl:grid-cols-4'}`}>
                    {personas.map((persona) => {
                        const visual = getVisual(persona.id);
                        return (
                        <button
                            key={persona.id}
                            onClick={() => setActivePersonaId(persona.id)}
                            className={`py-2.5 px-1 rounded-lg font-display font-bold uppercase tracking-wider text-[11px] sm:text-sm flex flex-col items-center gap-1.5 transition-all border-b-2
                                    ${effectiveActivePersonaId === persona.id ? `${visual.bg} ${visual.color} ${visual.border}` : 'border-transparent text-slate-500 hover:bg-white/5'}
                `}
                        >
                            {visual.icon}
                            {persona.name}
                        </button>
                    );})}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={effectiveActivePersonaId}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="flex items-center justify-between bg-black/40 p-4 rounded-lg border border-white/5">
                                <span className="font-mono text-slate-400">{pickLocalized(language, 'Jüri Notu', 'Jury score')}</span>
                                <span className={`font-display text-3xl font-bold ${getVisual(activePersona.id).color}`}>
                                    {activePersona.score || 0}
                                    <span className="text-lg text-slate-600">/100</span>
                                </span>
                            </div>

                            <div className="prose prose-invert prose-slate max-w-none text-sm md:text-base prose-headings:font-display prose-headings:uppercase prose-headings:tracking-wider prose-h3:text-lg prose-h3:text-white/90 prose-p:leading-relaxed prose-a:text-neon-red prose-strong:text-white">
                                <ReactMarkdown>
                                    {activePersona.critique || pickLocalized(language, 'Eleştiri yüklenemedi.', 'Could not load critique.')}
                                </ReactMarkdown>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className="mt-auto pt-4 border-t border-white/10">
                    {handlePremium && (
                        <button
                            onClick={handlePremium}
                            className="mb-2 w-full rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-3 font-mono text-[11px] font-bold uppercase tracking-wider text-neon-red transition-colors hover:bg-neon-red/20"
                        >
                            {pickLocalized(language, 'Juri Kararlarindan Kurtarma Plani Cikar', 'Build a rescue plan from jury critiques')} ({RAPIDO_COSTS.PREMIUM_RESCUE} Rapido)
                        </button>
                    )}
                    <button
                        onClick={handlePreserveAnalysis}
                        disabled={!handlePreserveAnalysis}
                        className="mb-2 w-full py-3 font-bold uppercase tracking-wider border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-100 transition-colors flex items-center justify-center gap-2"
                    >
                        {pickLocalized(language, 'Analizi Koru', 'Preserve analysis')} (1.5 Rapido)
                    </button>
                    <button
                        onClick={handleShareToCommunity}
                        disabled={!handleShareToCommunity}
                        className="mb-2 w-full py-3 font-bold uppercase tracking-wider border border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {pickLocalized(language, 'Toplulukta Paylaş', 'Share on community')}
                    </button>
                    <button
                        onClick={handleNewProject}
                        className="w-full py-4 font-bold uppercase tracking-wider bg-white text-black hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={18} /> {pickLocalized(language, 'Yeni Proje', 'New project')}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
