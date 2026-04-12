import { motion } from 'framer-motion';
import { Trophy, Medal, Star, Building2, ShieldAlert, Badge as BadgeIcon } from 'lucide-react';
import { LeaderboardUser, Badge } from '@/types';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

interface LeaderboardStepProps {
    earnedBadges: Badge[];
    userName: string;
    score: number;
}

export function LeaderboardStep({ earnedBadges, userName, score }: LeaderboardStepProps) {
    const language = useLanguage();
    // Mock Data
    const leaderboardData: LeaderboardUser[] = [
        {
            id: 'u1', name: 'Zeynep Y.', university: 'İTÜ', score: 2840,
            badges: [{ id: 'b1', name: pickLocalized(language, 'Sirkülasyon Ustası', 'Circulation master'), icon: '🔄', description: '', earned: true }]
        },
        {
            id: 'u2', name: 'Emre C.', university: 'ODTÜ', score: 2650,
            badges: [{ id: 'b2', name: pickLocalized(language, 'Brutal Jüri\'den Sağ Çıkan', 'Survivor of the brutal jury'), icon: '🩸', description: '', earned: true }, { id: 'b3', name: pickLocalized(language, 'Wall of Death Müdavimi', 'Wall of Death regular'), icon: '💀', description: '', earned: true }]
        },
        {
            id: 'u3', name: 'Berkay S.', university: 'YTÜ', score: 2100,
            badges: []
        },
        {
            id: 'u4', name: 'Ayşe K.', university: 'Bilkent', score: 1950,
            badges: [{ id: 'b4', name: pickLocalized(language, 'Betonarme Aşığı', 'Reinforced concrete lover'), icon: '🏢', description: '', earned: true }]
        },
        {
            id: 'u5', name: 'Canberk T.', university: 'İTÜ', score: 1820,
            badges: []
        }
    ];

    const universityStats = [
        { name: 'İTÜ', score: 4660, students: 142 },
        { name: 'ODTÜ', score: 3850, students: 98 },
        { name: 'YTÜ', score: 3100, students: 115 },
        { name: 'Mimar Sinan', score: 2900, students: 88 },
    ];

    return (
        <motion.div
            key="leaderboard"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-6xl flex flex-col mt-12 gap-12"
        >
            <div className="text-center mb-8">
                <h2 className="font-display text-4xl font-bold uppercase tracking-wider mb-4 flex items-center justify-center gap-3">
                    <Trophy className="text-yellow-500" size={36} /> {pickLocalized(language, 'Küresel Sıralama', 'Global leaderboard')}
                </h2>
                <p className="text-slate-400 max-w-2xl mx-auto font-mono text-sm leading-relaxed">{pickLocalized(language, 'Stüdyolar arası rekabet kızışıyor. Jüride sağ kalarak hem kendi rütbeni hem de okulunun sıralamasını yükselt.', 'The competition between studios is heating up. Survive the jury and raise both your rank and your school’s ranking.')}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Global Rank */}
                <div className="lg:col-span-8 bg-[#111827] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-6 border-b border-white/10 bg-black/50 flex items-center justify-between">
                        <h3 className="font-display text-xl font-bold uppercase tracking-wider flex items-center gap-2">
                            <Star className="text-yellow-500" size={20} /> {pickLocalized(language, 'En İyi Mimarlar', 'Top architects')}
                        </h3>
                        <span className="text-xs font-mono text-slate-500">{pickLocalized(language, 'Sezon 1', 'Season 1')}</span>
                    </div>

                    {/* Current User Row */}
                    <div className="p-4 md:p-6 bg-neon-red/10 border-b border-neon-red/30 flex items-center gap-4 relative">
                        <div className="absolute left-0 top-0 w-1 h-full bg-neon-red"></div>
                        <div className="w-8 text-center font-display text-xl font-bold text-neon-red">-</div>
                        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
                            <div>
                                <h4 className="font-bold text-lg text-white font-sans flex items-center gap-2">
                                    {userName}
                                    <div className="flex gap-1 ml-2">
                                        {earnedBadges.map(b => (
                                            <span key={b.id} title={b.name} className="text-base">{b.icon}</span>
                                        ))}
                                    </div>
                                </h4>
                                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                                    <Building2 size={12} /> {pickLocalized(language, 'Bilinmiyor', 'Unknown')}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="font-bold text-xl text-emerald-400 font-mono">{score}</span>
                                <span className="text-xs text-slate-500 block">{pickLocalized(language, 'Puan', 'Score')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-white/5 flex-1 overflow-y-auto">
                        {leaderboardData.map((user, index) => (
                            <div key={user.id} className="p-4 md:p-6 flex items-center gap-4 hover:bg-white/5 transition-colors">
                                <div className="w-8 text-center font-display text-xl font-bold text-slate-500">
                                    {index === 0 ? <Medal className="text-yellow-500 mx-auto" size={24} /> :
                                        index === 1 ? <Medal className="text-slate-300 mx-auto" size={24} /> :
                                            index === 2 ? <Medal className="text-amber-600 mx-auto" size={24} /> :
                                                `#${index + 1}`}
                                </div>

                                <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4">
                                    <div>
                                        <h4 className="font-bold text-lg text-white font-sans flex items-center gap-2">
                                            {user.name}
                                            <div className="flex gap-1 ml-2">
                                                {user.badges.map(b => (
                                                    <span key={b.id} title={b.name} className="text-base">{b.icon}</span>
                                                ))}
                                            </div>
                                        </h4>
                                        <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                                            <Building2 size={12} /> {user.university}
                                        </span>
                                    </div>

                                    <div className="text-right">
                                        <span className="font-bold text-xl text-emerald-400 font-mono">{user.score}</span>
                                        <span className="text-xs text-slate-500 block">Puan</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: University Rank */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <div className="bg-[#111827] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-white/10 bg-black/50">
                            <h3 className="font-display text-xl font-bold uppercase tracking-wider flex items-center gap-2">
                                <ShieldAlert className="text-neon-red" size={20} /> {pickLocalized(language, 'Stüdyo Savaşları', 'Studio wars')}
                            </h3>
                        </div>
                        <div className="p-4 space-y-4">
                            {universityStats.map((uni, idx) => (
                                <div key={idx} className="relative overflow-hidden bg-black/50 rounded-lg p-4 border border-white/5">
                                    <div className="flex justify-between items-center mb-2 relative z-10">
                                        <span className="font-bold text-white flex items-center gap-2">
                                            <span className="text-slate-500 font-mono text-sm">#{idx + 1}</span> {uni.name}
                                        </span>
                                        <span className="font-mono text-emerald-400 font-bold">{uni.score}</span>
                                    </div>
                                    <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden relative z-10">
                                        <div className="bg-neon-red h-full" style={{ width: `${(uni.score / universityStats[0].score) * 100}%` }}></div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 font-mono text-right relative z-10">{uni.students} {pickLocalized(language, 'Aktif Öğrenci', 'Active students')}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
