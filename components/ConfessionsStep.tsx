'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { MessageSquare, ArrowRight, Flame, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Static preview cards — hardcoded, no API calls in this component
// ---------------------------------------------------------------------------

interface PreviewConfession {
  id: string;
  textTr: string;
  textEn: string;
  likes: number;
  timeTr: string;
  timeEn: string;
}

const PREVIEW_CONFESSIONS: PreviewConfession[] = [
  {
    id: '1',
    textTr: 'Jüri paftama bakıp iç çekti ve hiçbir şey demeden sıradakine geçti...',
    textEn: 'The jury looked at my board, sighed, and moved to the next one without saying anything...',
    likes: 124,
    timeTr: '2 saat önce',
    timeEn: '2 hours ago',
  },
  {
    id: '2',
    textTr: 'Sabaha kadar render aldım, sabahtan akşama kadar jüri bekledim. Sonuç: "Buraya bir ağaç koysaydın."',
    textEn: 'I rendered all night and waited for the jury all day. Result: "You should have put a tree here."',
    likes: 89,
    timeTr: '5 saat önce',
    timeEn: '5 hours ago',
  },
  {
    id: '3',
    textTr: 'Maketi yapıştırırken parmağımı da makete yapıştırdım, öyle teslim ettim.',
    textEn: 'I glued my finger to the model while assembling it and submitted it like that.',
    likes: 210,
    timeTr: '1 gün önce',
    timeEn: '1 day ago',
  },
];

// ---------------------------------------------------------------------------
// ConfessionsStep — teaser / redirect component
// ---------------------------------------------------------------------------

export function ConfessionsStep() {
  const language = useLanguage();

  return (
    <motion.div
      key="confessions-step"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full max-w-xl mx-auto"
    >
      <div className="flex flex-col gap-6 p-8 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl">

        {/* Icon + label */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20">
            <MessageSquare size={24} className="text-purple-400" />
          </div>
          <span className="font-mono text-xs uppercase tracking-widest text-purple-400">
            {pickLocalized(language, 'Anonim İtiraflar', 'Anonymous Confessions')}
          </span>
        </div>

        {/* Heading */}
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-2xl uppercase tracking-wider font-bold text-white">
            {pickLocalized(language, 'Stüdyo İtirafları', 'Studio Confessions')}
          </h2>
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <ShieldCheck size={14} className="text-purple-400 shrink-0" />
            <span>
              {pickLocalized(
                language,
                'Tamamen anonim. Moderasyon var.',
                'Completely anonymous. AI-moderated.',
              )}
            </span>
          </div>
        </div>

        {/* Preview confession cards */}
        <div className="flex flex-col gap-3">
          {PREVIEW_CONFESSIONS.map((confession, idx) => (
            <motion.div
              key={confession.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07, duration: 0.3 }}
              className="bg-black/40 border border-white/5 rounded-xl p-4 hover:border-purple-500/20 transition-colors"
            >
              <p className="text-white/90 text-sm italic leading-relaxed mb-3 line-clamp-2">
                &ldquo;{pickLocalized(language, confession.textTr, confession.textEn)}&rdquo;
              </p>
              <div className="flex items-center justify-between text-slate-500 font-mono text-xs">
                <span>{pickLocalized(language, confession.timeTr, confession.timeEn)}</span>
                <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-full">
                  <Flame size={12} className={confession.likes > 100 ? 'text-orange-400' : 'text-slate-500'} />
                  <span>{confession.likes}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/confessions"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-purple-500 hover:bg-purple-400 rounded-xl text-white font-mono text-xs uppercase tracking-widest font-bold transition-colors"
        >
          {pickLocalized(language, 'Tüm İtirafları Gör', 'See All Confessions')}
          <ArrowRight size={15} />
        </Link>
      </div>
    </motion.div>
  );
}
