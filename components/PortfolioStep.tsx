import { useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Crown, AlertTriangle, FileText, ArrowRight } from 'lucide-react';
import html2canvas from 'html2canvas';
import { GalleryItem } from '@/types';

interface PortfolioStepProps {
    isPremiumUser: boolean;
    galleryItems: GalleryItem[];
}

export function PortfolioStep({ isPremiumUser, galleryItems }: PortfolioStepProps) {
    const exportRef = useRef<HTMLDivElement>(null);

    // For demo purposes, we construct a portfolio out of HALL_OF_FAME items
    const portfolioItems = galleryItems.filter(item => item.type === 'HALL_OF_FAME').slice(0, 4);

    const handleExport = async () => {
        if (exportRef.current) {
            try {
                const canvas = await html2canvas(exportRef.current, { backgroundColor: '#F8FAFC', scale: 2 });
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.download = 'my-architecture-portfolio.png';
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error("Export failed", err);
                alert("Portfolyo dışa aktarılamadı.");
            }
        }
    };

    if (!isPremiumUser) {
        return (
            <div className="w-full max-w-4xl flex flex-col items-center justify-center p-12 bg-black/50 border border-white/10 rounded-xl">
                <AlertTriangle size={48} className="text-yellow-500 mb-4" />
                <h2 className="text-2xl font-display font-bold text-white mb-2 uppercase tracking-wide">AI Portfolyo (Premium Özel)</h2>
                <p className="text-slate-400 text-center mb-6">Tasarımlarınızı tek tıkla profesyonel bir portfolyoya dönüştürmek için Premium üye olmalısınız.</p>
                <div className="px-6 py-3 bg-white/5 border border-white/10 rounded text-slate-300 font-mono text-sm">Header&apos;dan Premium modunu aktifleştirerek deneyebilirsiniz.</div>
            </div>
        );
    }

    return (
        <motion.div
            key="portfolio"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-6xl flex flex-col gap-6"
        >
            <div className="flex justify-between items-center bg-[#111827] p-6 rounded-xl border border-white/10 shadow-2xl">
                <div>
                    <h2 className="font-display text-2xl font-bold uppercase tracking-wide flex items-center gap-2 text-white">
                        <FileText className="text-emerald-500" /> AI Portfolyo Oluşturucu
                    </h2>
                    <p className="text-sm text-slate-400 font-mono mt-1">Sistemdeki yüksek puanlı projelerinden statik portfolyo oluşturuldu.</p>
                </div>
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded uppercase font-bold text-sm tracking-wider transition-colors"
                >
                    <Download size={18} /> PNG İndir
                </button>
            </div>

            {/* A4 Proportion Canvas Wrapper for Export */}
            <div className="overflow-x-auto custom-scrollbar pb-8">
                <div
                    ref={exportRef}
                    className="bg-slate-50 w-[800px] md:w-[1000px] min-h-[1414px] mx-auto shadow-2xl relative text-slate-900 p-16 flex flex-col"
                >
                    {/* Header */}
                    <div className="border-b-4 border-slate-900 pb-8 mb-12 flex justify-between items-end">
                        <div>
                            <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none mb-2">Selected<br />Works</h1>
                            <p className="text-slate-500 font-mono uppercase tracking-widest text-sm">2024 — Architecture Portfolio</p>
                        </div>
                        <div className="text-right">
                            <p className="font-bold text-xl uppercase">Sen (Misafir)</p>
                            <p className="text-slate-500 font-mono text-sm">student@architecture.edu</p>
                        </div>
                    </div>

                    {/* Grid Layout */}
                    <div className="flex-1 grid grid-cols-2 gap-12 auto-rows-max">
                        {portfolioItems.map((item, idx) => (
                            <div key={item.id} className={`flex flex-col gap-4 ${idx % 3 === 0 ? 'col-span-2' : 'col-span-1'}`}>
                                <div className={`w-full overflow-hidden bg-slate-200 ${idx % 3 === 0 ? 'aspect-[21/9]' : 'aspect-square'}`}>
                                    <img src={item.img} alt={item.title} className="w-full h-full object-cover grayscale opacity-90 hover:grayscale-0 hover:opacity-100 transition-all duration-700" />
                                </div>
                                <div className="flex gap-4 items-start">
                                    <h3 className="text-xl font-bold uppercase tracking-tight w-1/3">{item.title}</h3>
                                    <div className="w-2/3">
                                        <p className="text-sm text-slate-600 font-serif leading-relaxed line-clamp-3">
                                            {item.jury}
                                        </p>
                                        <div className="flex items-center gap-1 mt-3 font-mono text-xs text-slate-400">
                                            <span>Read More</span> <ArrowRight size={12} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="mt-auto pt-16 border-t border-slate-300 flex justify-between text-xs font-mono text-slate-400">
                        <span>Generated by Draw or Die AI</span>
                        <span>Page 1 / 1</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
