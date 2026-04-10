import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ThumbsUp, Flame, Send } from 'lucide-react';

export interface Confession {
    id: string;
    text: string;
    likes: number;
    time: string;
}

export function ConfessionsStep() {
    const [confessions, setConfessions] = useState<Confession[]>([
        { id: '1', text: 'Jüri paftama bakıp iç çekti ve hiçbir şey demeden sıradakine geçti...', likes: 124, time: '2 saat önce' },
        { id: '2', text: 'Sabaha kadar render aldım, sabahtan akşama kadar jüri bekledim. Sonuç: &quot;Buraya bir ağaç koysaydın.&quot;', likes: 89, time: '5 saat önce' },
        { id: '3', text: 'Maketi yapıştırırken parmağımı da makete yapıştırdım, öyle teslim ettim.', likes: 210, time: '1 gün önce' }
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
                    <MessageSquare className="text-purple-500" size={36} /> Studio Confessions
                </h2>
                <p className="text-slate-400 max-w-2xl mx-auto font-mono text-sm leading-relaxed">
                    Stüdyoda yaşananlar stüdyoda kalmaz. Jüriden, projeden, uykusuzluktan şikayet etmek serbest. Tamamen anonim.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-[#111827] border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl relative">
                <textarea
                    value={newConfession}
                    onChange={(e) => setNewConfession(e.target.value)}
                    placeholder="İçini dök... (Anonim gönderilecektir)"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-purple-500 transition-colors resize-none mb-4 min-h-[120px]"
                />
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={!newConfession.trim()}
                        className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-lg uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Send size={16} /> İtiraf Et
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
