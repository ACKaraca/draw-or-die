import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ThumbsUp, Flame, Send } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

export interface Confession {
    id: string;
    text: string;
    likes: number;
    time: string;
}

export function ConfessionsStep() {
    const language = useLanguage();
    const [confessions, setConfessions] = useState<Confession[]>([
        { id: '1', text: pickLocalized(language, 'Jüri paftama bakıp iç çekti ve hiçbir şey demeden sıradakine geçti...', 'The jury looked at my board, sighed, and moved to the next one without saying anything...'), likes: 124, time: pickLocalized(language, '2 saat önce', '2 hours ago') },
        { id: '2', text: pickLocalized(language, 'Sabaha kadar render aldım, sabahtan akşama kadar jüri bekledim. Sonuç: &quot;Buraya bir ağaç koysaydın.&quot;', 'I rendered all night and waited for the jury all day. Result: &quot;You should have put a tree here.&quot;'), likes: 89, time: pickLocalized(language, '5 saat önce', '5 hours ago') },
        { id: '3', text: pickLocalized(language, 'Maketi yapıştırırken parmağımı da makete yapıştırdım, öyle teslim ettim.', 'I glued my finger to the model while assembling it and submitted it like that.'), likes: 210, time: pickLocalized(language, '1 gün önce', '1 day ago') }
    ]);
    const [newConfession, setNewConfession] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newConfession.trim()) return;

        setConfessions(prev => [{
            id: Date.now().toString(),
            text: newConfession,
            likes: 0,
            time: 'Az önce'
        }, ...prev]);
        setNewConfession('');
    };

    const handleLike = (id: string) => {
        setConfessions(prev => prev.map(c =>
            c.id === id ? { ...c, likes: c.likes + 1 } : c
        ));
    };

    return (
        <motion.div
            key="confessions"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-4xl flex flex-col mt-12 gap-8"
        >
            <div className="text-center mb-4">
                <h2 className="font-display text-4xl font-bold uppercase tracking-wider mb-4 flex items-center justify-center gap-3">
                    <MessageSquare className="text-purple-500" size={36} /> {pickLocalized(language, 'Stüdyo İtirafları', 'Studio confessions')}
                </h2>
                <p className="text-slate-400 max-w-2xl mx-auto font-mono text-sm leading-relaxed">{pickLocalized(language, 'Stüdyoda yaşananlar stüdyoda kalmaz. Jüriden, projeden, uykusuzluktan şikayet etmek serbest. Tamamen anonim.', 'What happens in the studio does not stay in the studio. You are free to complain about the jury, the project, and the sleepless nights. Completely anonymous.')}</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-[#111827] border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl relative">
                <textarea
                    value={newConfession}
                    onChange={(e) => setNewConfession(e.target.value)}
                    placeholder={pickLocalized(language, 'İçini dök... (Anonim gönderilecektir)', 'Vent it out... (Will be posted anonymously)')}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-500 transition-colors resize-none mb-4 min-h-[120px]"
                />
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={!newConfession.trim()}
                        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Send size={16} /> {pickLocalized(language, 'İtiraf Et', 'Submit confession')}
                    </button>
                </div>
            </form>

            <div className="space-y-4">
                <AnimatePresence>
                    {confessions.map(confession => (
                        <motion.div
                            key={confession.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-black/60 border border-white/5 rounded-xl p-6 hover:border-white/10 transition-colors"
                        >
                            <p className="text-white font-sans text-lg md:text-xl leading-relaxed mb-6">
                                &quot;{confession.text}&quot;
                            </p>
                            <div className="flex items-center justify-between text-slate-500 font-mono text-xs">
                                <span>{confession.time}</span>
                                <button
                                    onClick={() => handleLike(confession.id)}
                                    className="flex items-center gap-2 hover:text-red-500 transition-colors bg-white/5 px-3 py-1.5 rounded-full"
                                >
                                    <Flame size={14} className={confession.likes > 100 ? 'text-red-500' : ''} /> {confession.likes}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
