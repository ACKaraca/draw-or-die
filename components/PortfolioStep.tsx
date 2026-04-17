import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Layers, Sparkles } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

export function PortfolioStep() {
    const language = useLanguage();

    return (
        <motion.div
            key="portfolio-step"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full max-w-xl mx-auto"
        >
            <div className="flex flex-col gap-6 p-8 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl">
                {/* Icon + label */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400/10 border border-amber-400/20">
                        <Layers size={24} className="text-amber-400" />
                    </div>
                    <span className="font-mono text-xs uppercase tracking-widest text-amber-400">
                        {pickLocalized(language, 'Portfolyo Modülü', 'Portfolio Module')}
                    </span>
                </div>

                {/* Heading */}
                <div className="flex flex-col gap-2">
                    <h2 className="font-display text-2xl uppercase tracking-wider font-bold text-white">
                        {pickLocalized(language, 'Portfolyo Oluşturucu', 'Portfolio Builder')}
                    </h2>
                    <p className="text-sm text-slate-400 leading-relaxed">
                        {pickLocalized(
                            language,
                            'Projelerinizi seçin, AI destekli düzen oluşturun ve A4 formatında profesyonel mimari portfolyo hazırlayın.',
                            'Select your projects, generate AI-assisted layouts, and create professional architectural portfolios in A4 format.',
                        )}
                    </p>
                </div>

                {/* Cost info */}
                <div className="flex items-center gap-3 px-4 py-3 bg-black/40 border border-white/10 rounded-xl">
                    <Sparkles size={16} className="text-amber-400 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-xs uppercase tracking-widest text-slate-300">
                            {pickLocalized(language, 'Sayfa başına 4 rapido', 'Page generation costs 4 rapido')}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                            {pickLocalized(
                                language,
                                'Her sayfada görsel URL\'leri + tema seçimi ile AI düzen üretimi.',
                                'Each page uses image URLs + theme selection to generate an AI layout.',
                            )}
                        </span>
                    </div>
                </div>

                {/* CTA */}
                <Link
                    href="/portfolio"
                    className="flex items-center justify-center gap-2 w-full py-3.5 bg-amber-500 hover:bg-amber-400 rounded-xl text-black font-mono text-xs uppercase tracking-widest font-bold transition-colors"
                >
                    {pickLocalized(language, 'Portfolyo Oluşturucu\'ya Git', 'Open Portfolio Builder')}
                    <ArrowRight size={15} />
                </Link>
            </div>
        </motion.div>
    );
}
