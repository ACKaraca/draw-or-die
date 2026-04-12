import { motion } from 'framer-motion';
import { Calendar, ArrowRight, Zap, Trophy } from 'lucide-react';
import { Charette } from '@/types';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

interface CharetteStepProps {
    setStep: (step: any) => void;
}

export function CharetteStep({ setStep }: CharetteStepProps) {
    const language = useLanguage();
    // Mock Data
    const currentCharette: Charette = {
        id: 'ch-week12',
        title: pickLocalized(language, '3x3 Metrelik Meditasyon Kabini', '3x3 meter meditation cabin'),
        description: pickLocalized(language, 'Sadece 9 metrekarelik bir alanda, doğayla iç içe, ruhsal bir arınma mekanı tasarla. Malzeme paleti ve ışık kullanımı jürinin odak noktası olacak.', 'Design a spiritual retreat immersed in nature within just 9 square meters. Material palette and lighting will be the jury’s focus.'),
        deadline: pickLocalized(language, 'Pazar 23:59', 'Sunday 23:59'),
        reward: 50,
        participants: 128
    };

    const previousCharettes: Charette[] = [
        { id: 'ch-week11', title: pickLocalized(language, 'Distopik Otobüs Durağı', 'Dystopian bus stop'), description: '', deadline: pickLocalized(language, 'Geçti', 'Ended'), reward: 30, participants: 342 },
        { id: 'ch-week10', title: pickLocalized(language, 'Kedi Evi (Brutalist)', 'Cat house (brutalist)'), description: '', deadline: pickLocalized(language, 'Geçti', 'Ended'), reward: 30, participants: 512 }
    ];

    return (
        <motion.div
            key="charettes"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-5xl flex flex-col mt-12 gap-12"
        >
            <div className="text-center">
                <h2 className="font-display text-4xl font-bold uppercase tracking-wider mb-4 flex items-center justify-center gap-3">
                    <Calendar className="text-neon-red" size={36} /> {pickLocalized(language, 'Haftalık Çareler', 'Weekly charettes')}
                </h2>
                <p className="text-slate-400 max-w-2xl mx-auto mb-8">{pickLocalized(language, 'Efsanevi mimarların ofisine ışınlanıyoruz. Her hafta yeni bir &quot;zorlu&quot; tasarım konusu. 2 saat içinde eskizini yükle, jüriyi ikna etmeye çalış.', 'We teleport into the office of legendary architects. Every week brings a new &quot;challenging&quot; design prompt. Upload your sketch within 2 hours and try to convince the jury.')}</p>
            </div>

            {/* Active Charette */}
            <div className="bg-gradient-to-br from-[#111827] to-[#1a2333] border border-neon-red/30 rounded-2xl p-8 shadow-[0_0_30px_rgba(255,0,51,0.1)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-red/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="flex flex-col md:flex-row gap-8 items-center md:items-start justify-between relative z-10">
                    <div className="flex-1">
                        <span className="inline-block px-3 py-1 bg-neon-red/10 border border-neon-red/30 text-neon-red text-xs font-mono font-bold uppercase rounded mb-4 animate-pulse">
                            {pickLocalized(language, 'Aktif Görev', 'Active task')}
                        </span>
                        <h3 className="text-3xl font-display font-bold text-white mb-4">{currentCharette.title}</h3>
                        <p className="text-slate-300 font-sans leading-relaxed mb-6">{currentCharette.description}</p>
                        <div className="flex flex-wrap gap-4 font-mono text-sm">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Calendar size={16} /> <span className="text-white">{pickLocalized(language, 'Son Teslim:', 'Due:')} {currentCharette.deadline}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                                <Zap size={16} className="text-yellow-500" /> <span className="text-white font-bold">{currentCharette.reward} {pickLocalized(language, 'Rapido Ödülü', 'Rapido reward')}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                                <Trophy size={16} /> <span>{currentCharette.participants} {pickLocalized(language, 'Katılımcı', 'Participants')}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-shrink-0 w-full md:w-auto">
                        <button
                            onClick={() => setStep('upload')}
                            className="w-full md:w-auto bg-neon-red hover:bg-[#cc0029] text-white font-bold py-4 px-8 uppercase tracking-wider transition-colors flex items-center justify-center gap-2 group"
                        >
                            {pickLocalized(language, 'Projeyi Yükle', 'Upload project')} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Previous Charettes */}
            <div>
                <h3 className="font-display text-2xl font-bold uppercase tracking-wider mb-6 text-slate-300 border-b border-white/10 pb-4">
                    {pickLocalized(language, 'Geçmiş Görevler', 'Past tasks')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {previousCharettes.map(ch => (
                        <div key={ch.id} className="bg-black/40 border border-white/10 rounded-xl p-6 opacity-70 hover:opacity-100 transition-opacity">
                            <h4 className="font-display text-xl font-bold text-white mb-2">{ch.title}</h4>
                            <div className="flex justify-between items-center text-xs font-mono text-slate-500">
                                <span>{ch.participants} {pickLocalized(language, 'Teslim', 'Submissions')}</span>
                                <span className="text-neon-red">{pickLocalized(language, 'Süresi Doldu', 'Expired')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
