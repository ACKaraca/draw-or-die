import { motion } from 'framer-motion';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

export function AnalyzingStep() {
    const language = useLanguage();
    return (
        <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center"
        >
            <div className="w-24 h-24 border-4 border-neon-red/20 border-t-neon-red rounded-full animate-spin mb-8"></div>
            <h2 className="font-display text-3xl font-bold uppercase mb-2">
                {pickLocalized(language, 'Jüri İnceliyor...', 'Jury is reviewing...')}
            </h2>
            <p className="font-mono text-slate-400">
                {pickLocalized(language, '"Bu ne biçim bir sirkülasyon şeması?"', '"What kind of circulation diagram is this?"')}
            </p>
        </motion.div>
    );
}

export function PremiumAnalyzingStep() {
    const language = useLanguage();
    return (
        <motion.div
            key="premium-analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center"
        >
            <div className="w-24 h-24 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin mb-8"></div>
            <h2 className="font-display text-3xl font-bold uppercase mb-2 text-yellow-500">
                {pickLocalized(language, 'Kırmızı Kalem Çekiliyor...', 'Red pen is coming out...')}
            </h2>
            <p className="font-mono text-slate-400">
                {pickLocalized(language, '"Çözüm yolları aranıyor..."', '"Looking for solution paths..."')}
            </p>
        </motion.div>
    );
}

export function MultiAnalyzingStep() {
    const language = useLanguage();
    return (
        <motion.div
            key="multi-analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center text-center"
        >
            <div className="flex gap-4 mb-8">
                <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <h2 className="font-display text-3xl font-bold uppercase mb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-red-500">
                {pickLocalized(language, 'Jüri Konseyi Toplandı...', 'Jury council has convened...')}
            </h2>
            <p className="font-mono text-slate-400">
                {pickLocalized(language, '"Strüktürcü, konseptüel ve huysuz jüriler tartışıyor..."', '"Structural, conceptual, and grumpy juries are debating..."')}
            </p>
        </motion.div>
    );
}
