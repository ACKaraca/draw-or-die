import { Crown, X, ArrowRight } from 'lucide-react';
import Markdown from 'react-markdown';
import { DefenseMessage } from '@/types';
import { RAPIDO_COSTS } from '@/lib/pricing';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

interface ChatDefenseProps {
    isPremiumUser: boolean;
    isDefending: boolean;
    setIsDefending: (val: boolean) => void;
    defenseTurnCount: number;
    defenseMessages: DefenseMessage[];
    isDefenseLoading: boolean;
    defenseInput: string;
    setDefenseInput: (val: string) => void;
    handleDefenseSubmit: () => void;
}

export function ChatDefense({
    isPremiumUser,
    isDefending,
    setIsDefending,
    defenseTurnCount,
    defenseMessages,
    isDefenseLoading,
    defenseInput,
    setDefenseInput,
    handleDefenseSubmit
}: ChatDefenseProps) {
    const language = useLanguage();
    if (!isPremiumUser) return null;

    return (
        <div className="mt-6 border border-white/10 rounded-xl bg-black/30 overflow-hidden">
            {!isDefending ? (
                <div className="p-6 flex items-center justify-between border-t-2 border-transparent hover:border-neon-red transition-all cursor-pointer" onClick={() => setIsDefending(true)}>
                    <div>
                        <h3 className="font-bold text-white mb-1 flex items-center gap-2">
                            <Crown className="text-yellow-500" size={16} /> {pickLocalized(language, 'Projeyi Savun (Chat Modu)', 'Defend Your Project (Chat Mode)')}
                        </h3>
                        <p className="text-sm text-slate-400 text-left">
                            {pickLocalized(language, 'Jüriye karşı projeni savun. İkna edersen ekstra puan kap! (Max 3 Mesaj)', 'Defend your project against the jury. If you convince them, you earn bonus points! (Max 3 messages)')}
                        </p>
                    </div>
                    <button className="px-4 py-2 border border-neon-red text-neon-red hover:bg-neon-red hover:text-white font-bold transition-colors rounded text-sm text-nowrap pointer-events-none">
                        {pickLocalized(language, 'Savun', 'Defend')} ({RAPIDO_COSTS.DEFENSE} Rapido)
                    </button>
                </div>
            ) : (
                <div className="flex flex-col h-96">
                    <div className="bg-white/5 p-3 flex justify-between items-center border-b border-white/10">
                        <span className="font-bold text-sm flex items-center gap-2">
                            <Crown className="text-yellow-500" size={14} /> {pickLocalized(language, 'Savunma', 'Defense')} ({defenseTurnCount}/3)
                        </span>
                        <button onClick={() => setIsDefending(false)} className="text-slate-400 hover:text-white bg-black/50 p-1 rounded">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                        {defenseMessages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] p-3 rounded-lg text-sm prose prose-invert prose-p:my-1 prose-sm ${msg.role === 'user' ? 'bg-neon-red text-white rounded-br-none' : 'bg-[#111827] border border-white/10 text-slate-300 rounded-bl-none'}`}>
                                    <Markdown>{msg.text}</Markdown>
                                </div>
                            </div>
                        ))}
                        {isDefenseLoading && (
                            <div className="flex justify-start">
                                <div className="bg-[#111827] border border-white/10 text-slate-400 p-3 rounded-lg text-sm rounded-bl-none flex gap-1">
                                    <span className="animate-bounce">.</span><span className="animate-bounce delay-100">.</span><span className="animate-bounce delay-200">.</span>
                                </div>
                            </div>
                        )}
                        {defenseMessages.length === 0 && !isDefenseLoading && (
                            <div className="text-center text-slate-500 text-sm mt-4 italic">
                                {pickLocalized(language, 'İlk savunmanı yazarak jüriye meydan oku.', 'Issue your first defense and challenge the jury.')}
                            </div>
                        )}
                    </div>
                    <div className="p-3 border-t border-white/10 bg-black/50 flex gap-2">
                        <input
                            disabled={isDefenseLoading || defenseTurnCount >= 3}
                            type="text"
                            value={defenseInput}
                            onChange={e => setDefenseInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleDefenseSubmit()}
                            placeholder={defenseTurnCount >= 3
                                ? pickLocalized(language, 'Savunma hakkınız bitti.', 'Your defense turns are over.')
                                : pickLocalized(language, 'Mesajınızı yazın...', 'Write your message...')}
                            className="flex-1 bg-white/5 border border-white/10 rounded px-3 text-sm text-white focus:outline-none focus:border-neon-red disabled:opacity-50"
                        />
                        <button
                            disabled={isDefenseLoading || defenseTurnCount >= 3 || !defenseInput.trim()}
                            onClick={handleDefenseSubmit}
                            className="bg-neon-red text-white p-2 flex items-center justify-center w-10 h-10 rounded hover:bg-[#cc0029] disabled:opacity-50 transition-colors"
                        >
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
