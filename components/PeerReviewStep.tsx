import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ThumbsDown, MessageSquare } from 'lucide-react';
import { GalleryItem } from '@/types';

interface PeerReviewStepProps {
    galleryItems: GalleryItem[];
}

export function PeerReviewStep({ galleryItems }: PeerReviewStepProps) {
    // Just show Wall of Death items for peer review as mock data
    const reviewItems = galleryItems.filter(item => item.type === 'WALL_OF_DEATH');

    const [comments, setComments] = useState<Record<string, string>>({});
    const [votes, setVotes] = useState<Record<string, number>>({});

    const handleVote = (id: string) => {
        setVotes(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    };

    return (
        <motion.div
            key="peer-review"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-6xl mt-12 gap-8 flex flex-col items-center"
        >
            <div className="text-center mb-8">
                <h2 className="font-display text-4xl font-bold uppercase tracking-wider mb-4 flex items-center justify-center gap-3">
                    <Users className="text-blue-500" size={36} /> Peer Review
                </h2>
                <p className="text-slate-400 max-w-2xl mx-auto font-mono text-sm leading-relaxed">
                    Sadece AI yetmez, arkadaşların da gömsün. Diğer öğrencilerin projelerini eleştir, en acımasız oyu sen ver.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {reviewItems.map(item => (
                    <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-xl flex flex-col">
                        <div className="h-64 overflow-hidden relative group">
                            <img src={item.img} alt="Project" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => window.open(item.img, '_blank')} className="bg-white text-black px-4 py-2 font-bold uppercase text-xs tracking-wider rounded">Büyüt</button>
                            </div>
                        </div>

                        <div className="p-4 flex flex-col flex-1 gap-4">
                            <div className="flex justify-between items-start">
                                <div className="text-xs font-mono text-slate-400 bg-white/10 px-2 py-1 inline-block rounded">
                                    Yakın zamanda ezildi
                                </div>
                                <button
                                    onClick={() => handleVote(item.id)}
                                    className="flex items-center gap-1 text-red-500 hover:bg-white/5 px-2 py-1 rounded"
                                >
                                    <ThumbsDown size={14} /> {votes[item.id] || 0}
                                </button>
                            </div>

                            <p className="font-sans text-sm line-clamp-3 text-slate-300 flex-1">
                                {'"' + item.jury + '"'}
                            </p>

                            <div className="border-t border-white/10 pt-4 mt-auto">
                                <div className="flex relative">
                                    <input
                                        type="text"
                                        placeholder="Göm..."
                                        value={comments[item.id] || ''}
                                        onChange={(e) => setComments(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        className="w-full bg-black/50 border border-white/10 rounded-l p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                        onClick={() => {
                                            if (comments[item.id]) {
                                                alert('Eleştiriniz eklendi!');
                                                setComments(prev => ({ ...prev, [item.id]: '' }));
                                            }
                                        }}
                                        className="bg-blue-500 text-white p-2 rounded-r hover:bg-blue-600 transition-colors"
                                    >
                                        <MessageSquare size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {reviewItems.length === 0 && (
                <div className="text-center py-20 text-slate-500 font-mono">
                    Şu an gömülecek proje yok. Herkes çok iyi (sanırım).
                </div>
            )}
        </motion.div>
    );
}
