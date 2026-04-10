import { motion } from 'framer-motion';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { GalleryItem } from '@/types';

interface HeroStepProps {
    setStep: (step: any) => void;
    setCurrentGallery: (gallery: 'HALL_OF_FAME' | 'WALL_OF_DEATH' | 'COMMUNITY') => void;
    galleryItems: GalleryItem[];
}

export function HeroStep({ setStep, setCurrentGallery, galleryItems }: HeroStepProps) {
    return (
        <motion.div
            key="hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-7xl flex flex-col items-center"
        >
            <div className="text-center max-w-3xl mb-24 mt-12">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-red/10 border border-neon-red/30 text-neon-red text-xs font-mono mb-8">
                    <ShieldAlert size={14} />
                    <span>YAPAY ZEKA DESTEKLİ MİMARİ JÜRİ</span>
                </div>
                <h1 className="text-6xl md:text-8xl font-display font-bold tracking-tighter mb-6 uppercase">
                    Sisteme Paftanı At ve <br />
                    <span className="neon-text">Jüriyle Yüzleş</span>
                </h1>
                <p className="text-slate-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto font-sans">
                    Projelerini yükle, acımasız ve dürüst eleştiriler al. Hatalarınla yüzleş, projeni kurtar ya da jüride öl.
                </p>
                <button
                    onClick={() => setStep('upload')}
                    className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white bg-neon-red hover:bg-[#cc0029] transition-colors rounded-none overflow-hidden"
                >
                    <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black"></span>
                    <span className="relative flex items-center gap-2 font-mono uppercase tracking-wider">
                        Studio Desk&apos;e Geç <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                </button>
            </div>

            {/* Wall of Death Preview */}
            <div className="w-full border-t border-white/10 pt-16">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="font-display text-2xl font-bold uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 bg-neon-red"></span> Wall of Death
                    </h2>
                    <button
                        onClick={() => { setCurrentGallery('WALL_OF_DEATH'); setStep('gallery'); }}
                        className="text-xs font-mono text-slate-500 uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1"
                    >
                        Tümünü Gör <ArrowRight size={12} />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {galleryItems.filter(item => item.type === 'WALL_OF_DEATH').slice(0, 3).map((item, i) => (
                        <div key={i} className="group relative aspect-[3/4] bg-black/50 border border-white/10 rounded-xl overflow-hidden">
                            <img src={item.img} alt={item.title} className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
                            <div className="absolute inset-0 p-6 flex flex-col justify-end bg-gradient-to-t from-black via-black/50 to-transparent">
                                <h3 className="font-display font-bold text-xl text-white mb-2">{item.title}</h3>
                                <p className="font-mono text-xs text-neon-red leading-relaxed">&quot;{item.jury}&quot;</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
