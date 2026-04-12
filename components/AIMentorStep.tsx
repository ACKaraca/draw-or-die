import { useState, useRef, useEffect, useMemo, useCallback, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { Send, User, Bot, Sparkles, AlertTriangle, Plus, Paperclip, X, Trash2, Loader2 } from 'lucide-react';
import { generateAIResponse } from '@/lib/ai';
import Markdown from 'react-markdown';
import { Badge } from '@/types';
import { reportClientError } from '@/lib/logger';
import { account } from '@/lib/appwrite';
import type { SupportedLanguage } from '@/lib/i18n';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import { pickLocalized } from '@/lib/i18n';

interface AIMentorStepProps {
    isAuthenticated: boolean;
    userId: string | null;
    isAnonymous: boolean;
    isPremiumUser: boolean;
    progressionScore: number;
    earnedBadges: Badge[];
    onNavigateStudioDesk?: () => void;
    onUpgradeClick?: () => void;
    preferredLanguage?: SupportedLanguage;
}

type MentorQuickAction = {
    label: string;
    prompt: string;
};

type AttachmentPayload = {
    name: string;
    mimeType: string;
    base64: string;
    sizeBytes: number;
};

type MentorMessage = {
    id: string;
    role: 'user' | 'mentor';
    text: string;
    tokens: number;
    createdAt: string;
    attachmentName?: string | null;
    attachmentUrl?: string | null;
    attachmentMime?: string | null;
};

type MentorChat = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    monthKey: string;
    tokensUsed: number;
    tokenLimit: number;
    status: 'active' | 'locked' | string;
    isPremiumChat: boolean;
    lastMessageAt: string | null;
};

type MentorChatsResponse = {
    items: MentorChat[];
    total: number;
};

type MentorMessagesResponse = {
    chat: {
        id: string;
        title: string;
        tokensUsed: number;
        tokenLimit: number;
        status: string;
        monthKey: string;
    };
    items: MentorMessage[];
    total: number;
};

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const DEFAULT_MENTOR_ERROR = 'Mentor yanıtı alınamadı. Lütfen tekrar deneyin.';
const DEFAULT_MENTOR_ERROR_EN = 'Could not load mentor response. Please try again.';

type ApiFailure = Error & {
    code?: string;
    status?: number;
};

function normalizeMentorQuickActions(value: unknown): MentorQuickAction[] {
    if (!Array.isArray(value)) return [];

    return value
        .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const parsed = entry as { label?: unknown; prompt?: unknown };
            const label = typeof parsed.label === 'string' ? parsed.label.trim() : '';
            const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';
            if (!label || !prompt) return null;
            return {
                label: label.slice(0, 70),
                prompt: prompt.slice(0, 280),
            };
        })
        .filter((entry): entry is MentorQuickAction => Boolean(entry))
        .slice(0, 4);
}

function parseMentorResult(raw: string): { reply: string; quickActions: MentorQuickAction[] } {
    try {
        const parsed = JSON.parse(raw) as { reply?: unknown; quickActions?: unknown };
        if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
            return {
                reply: parsed.reply.trim(),
                quickActions: normalizeMentorQuickActions(parsed.quickActions),
            };
        }
    } catch {
        // plain text fallback
    }
    return { reply: raw, quickActions: [] };
}

function normalizeChatLabel(value: string): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return 'Yeni Mentorluk Sohbeti';
    return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
}

export function AIMentorStep({ isAuthenticated, userId: _userId, isAnonymous, isPremiumUser, progressionScore, earnedBadges: _earnedBadges, onNavigateStudioDesk, onUpgradeClick, preferredLanguage = 'tr' }: AIMentorStepProps) {
    const language = useLanguage();
    const [chats, setChats] = useState<MentorChat[]>([]);
    const [messages, setMessages] = useState<MentorMessage[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isBootstrapping, setIsBootstrapping] = useState(false);
    const [isMessagesLoading, setIsMessagesLoading] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [pendingAttachment, setPendingAttachment] = useState<AttachmentPayload | null>(null);
    const [quickActions, setQuickActions] = useState<MentorQuickAction[]>([]);
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    const [showPremiumLimitPrompt, setShowPremiumLimitPrompt] = useState(false);
    const [blockedDraftMessage, setBlockedDraftMessage] = useState<string | null>(null);
    const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const activeChat = useMemo(
        () => chats.find((chat) => chat.id === activeChatId) ?? null,
        [activeChatId, chats]
    );

    const tokenPercent = activeChat
        ? Math.min(100, (activeChat.tokensUsed / Math.max(1, activeChat.tokenLimit)) * 100)
        : 0;

    const authedFetch = useCallback(async (url: string, init?: RequestInit) => {
        const jwt = await account.createJWT();
        const headers = new Headers(init?.headers ?? {});
        headers.set('Authorization', `Bearer ${jwt.jwt}`);
        if (init?.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        return fetch(url, {
            ...init,
            headers,
        });
    }, []);

    const parseError = useCallback(async (response: Response): Promise<ApiFailure> => {
        const payload = await response.json().catch(() => ({}));
        const err = new Error(
            typeof payload?.error === 'string' ? payload.error : pickLocalized(language, DEFAULT_MENTOR_ERROR, DEFAULT_MENTOR_ERROR_EN)
        ) as ApiFailure;
        err.code = typeof payload?.code === 'string' ? payload.code : undefined;
        err.status = response.status;
        return err;
    }, []);

    const loadChats = useCallback(async (): Promise<MentorChat[]> => {
        const response = await authedFetch('/api/mentor/chats?limit=30');
        if (!response.ok) {
            throw await parseError(response);
        }
        const payload = (await response.json()) as MentorChatsResponse;
        const items = Array.isArray(payload.items) ? payload.items : [];
        setChats(items);
        return items;
    }, [authedFetch, parseError]);

    const loadMessages = useCallback(async (chatId: string): Promise<MentorMessage[]> => {
        setIsMessagesLoading(true);
        try {
            const response = await authedFetch(`/api/mentor/chats/${encodeURIComponent(chatId)}/messages?limit=200`);
            if (!response.ok) {
                throw await parseError(response);
            }
            const payload = (await response.json()) as MentorMessagesResponse;
            const items = Array.isArray(payload.items) ? payload.items : [];
            setMessages(items);

            setChats((prev) =>
                prev.map((chat) =>
                    chat.id === chatId
                        ? {
                            ...chat,
                            tokensUsed: payload.chat.tokensUsed,
                            tokenLimit: payload.chat.tokenLimit,
                            status: payload.chat.status,
                            monthKey: payload.chat.monthKey,
                            title: payload.chat.title,
                        }
                        : chat
                )
            );
            return items;
        } finally {
            setIsMessagesLoading(false);
        }
    }, [authedFetch, parseError]);

    const createChat = useCallback(async (title?: string): Promise<MentorChat> => {
        const response = await authedFetch('/api/mentor/chats', {
            method: 'POST',
            body: JSON.stringify({ title }),
        });
        if (!response.ok) {
            throw await parseError(response);
        }

        const payload = (await response.json()) as { item?: MentorChat };
        if (!payload.item) {
            throw new Error(DEFAULT_MENTOR_ERROR);
        }
        return payload.item;
    }, [authedFetch, parseError]);

    useEffect(() => {
        if (!isAuthenticated) return;

        let cancelled = false;
        const bootstrap = async () => {
            setIsBootstrapping(true);
            setNotice(null);

            try {
                let existingChats = await loadChats();
                if (!cancelled && existingChats.length === 0) {
                    const created = await createChat();
                    existingChats = [created];
                    setChats(existingChats);
                }

                if (!cancelled && existingChats.length > 0) {
                    setActiveChatId(existingChats[0].id);
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : pickLocalized(language, DEFAULT_MENTOR_ERROR, DEFAULT_MENTOR_ERROR_EN);
                setNotice(message);
            } finally {
                if (!cancelled) setIsBootstrapping(false);
            }
        };

        void bootstrap();
        return () => {
            cancelled = true;
        };
    }, [createChat, isAuthenticated, loadChats]);

    useEffect(() => {
        if (!activeChatId || !isAuthenticated) return;
        setQuickActions([]);
        void loadMessages(activeChatId).catch((error) => {
            setNotice(error instanceof Error ? error.message : pickLocalized(language, DEFAULT_MENTOR_ERROR, DEFAULT_MENTOR_ERROR_EN));
        });
    }, [activeChatId, isAuthenticated, loadMessages]);

    useEffect(() => {
        if (!messagesContainerRef.current) return;
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }, [messages, isLoading, isMessagesLoading, activeChatId]);

    const handleNewChat = useCallback(() => {
        void (async () => {
            try {
                const chat = await createChat(input.trim().slice(0, 60));
                setChats((prev) => [chat, ...prev]);
                setActiveChatId(chat.id);
                setMessages([]);
                setInput('');
                setPendingAttachment(null);
                setQuickActions([]);
                setNotice(null);
                setShowUpgradePrompt(false);
                setShowPremiumLimitPrompt(false);
                setBlockedDraftMessage(null);
            } catch (error) {
                const typed = error as ApiFailure;
                setNotice(typed.message || DEFAULT_MENTOR_ERROR);
            }
        })();
    }, [createChat, input]);

    const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!allowed.includes(file.type)) {
            setNotice(pickLocalized(language, 'Mentor için sadece JPG, PNG veya PDF yükleyebilirsin.', 'You can only upload JPG, PNG, or PDF files for the mentor.'));
            return;
        }

        if (file.size > MAX_ATTACHMENT_BYTES) {
            setNotice(pickLocalized(language, 'Mentor dosya limiti 2 MB. Lütfen daha küçük dosya yükleyin.', 'Mentor file limit is 2 MB. Please upload a smaller file.'));
            return;
        }

        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result ?? ''));
                reader.onerror = () => reject(new Error(pickLocalized(language, 'Dosya okunamadı.', 'File could not be read.')));
                reader.readAsDataURL(file);
            });

            setPendingAttachment({
                name: file.name,
                mimeType: file.type,
                sizeBytes: file.size,
                base64: dataUrl.includes(',') ? dataUrl.split(',')[1] ?? '' : dataUrl,
            });
            setNotice(null);
        } catch (error) {
            void reportClientError({
                scope: 'mentor.attachment',
                message: 'Attachment processing failed',
                details: {
                    error: error instanceof Error ? error.message : String(error),
                },
            });
            setNotice(pickLocalized(language, 'Dosya okunamadı. Lütfen tekrar deneyin.', 'File could not be read. Please try again.'));
        }
    };

    const handleSend = async (options?: { extendPremiumChat?: boolean; forcedMessage?: string }) => {
        if (isLoading || !activeChat) return;

        const userText = (options?.forcedMessage ?? input).trim();
        if (!userText) return;

        const isLocked = activeChat.status === 'locked' || activeChat.tokensUsed >= activeChat.tokenLimit;
        if (isLocked && !options?.extendPremiumChat) {
            setBlockedDraftMessage(userText);
            setShowPremiumLimitPrompt(true);
            setNotice(pickLocalized(language, `Bu sohbet ${activeChat.tokenLimit} token limitine ulaştı. 2 Rapido ile devam edebilir veya yeni sohbet açabilirsin.`, `This chat reached its ${activeChat.tokenLimit} token limit. You can continue with 2 Rapido or start a new chat.`));
            return;
        }

        setIsLoading(true);
        setNotice(null);
        setShowUpgradePrompt(false);
        setShowPremiumLimitPrompt(false);

        try {
            const response = await generateAIResponse({
                locale: preferredLanguage,
                operation: 'AI_MENTOR',
                imageBase64: pendingAttachment?.base64,
                imageMimeType: pendingAttachment?.mimeType,
                params: {
                    language: preferredLanguage,
                    chatId: activeChat.id,
                    userMessage: userText,
                    progressionScore,
                    attachmentName: pendingAttachment?.name,
                    extendPremiumChat: options?.extendPremiumChat === true,
                }
            });

            const raw = response?.result ?? '';
            const parsed = parseMentorResult(raw);
            setQuickActions(parsed.quickActions);

            const [nextChats] = await Promise.all([
                loadChats(),
                loadMessages(activeChat.id),
            ]);

            const nextActive = nextChats.find((chat) => chat.id === activeChat.id);
            if (nextActive?.status === 'locked' || (nextActive && nextActive.tokensUsed >= nextActive.tokenLimit)) {
                setNotice(pickLocalized(language, `Bu sohbet ${nextActive.tokenLimit} token limitine ulaştı. 2 Rapido ile devam edebilir veya yeni sohbet seçebilirsin.`, `This chat reached its ${nextActive.tokenLimit} token limit. You can continue with 2 Rapido or choose a new chat.`));
                setShowPremiumLimitPrompt(true);
            }

            setInput('');
            setBlockedDraftMessage(null);
            setPendingAttachment(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : pickLocalized(language, 'Mentor yanıtı alınamadı.', 'Could not load mentor response.');

            void reportClientError({
                scope: 'mentor.send',
                message: 'Mentor request failed',
                details: {
                    error: message,
                },
            });

            if (message === 'MENTOR_PREMIUM_LIMIT_REACHED' || message === 'CHAT_TOKEN_LIMIT_REACHED') {
                setBlockedDraftMessage(userText);
                setShowPremiumLimitPrompt(true);
                setNotice(pickLocalized(language, 'Sohbet limiti doldu. 2 Rapido ile devam edebilir veya yeni sohbet açabilirsin.', 'The chat limit has been reached. You can continue with 2 Rapido or start a new chat.'));
            } else if (message === 'GUEST_MENTOR_DISABLED' || /misafir hesaplarda kapali/i.test(message)) {
                setNotice(pickLocalized(language, 'AI Mentor misafir hesaplarda kapalı. Lütfen kayıtlı hesaba geçin.', 'AI Mentor is disabled for guest accounts. Please switch to a registered account.'));
            } else if (message.startsWith('INSUFFICIENT_RAPIDO')) {
                setShowUpgradePrompt(true);
                setNotice(pickLocalized(language, 'Yetersiz Rapido. Lütfen bakiye yükleyin.', 'Insufficient Rapido. Please top up your balance.'));
            } else if (message.startsWith('RATE_LIMITED:')) {
                const waitRaw = Number(message.split(':')[1] ?? '60');
                const waitSeconds = Number.isFinite(waitRaw) ? Math.max(1, Math.ceil(waitRaw)) : 60;
                setNotice(pickLocalized(language, `Çok fazla istek gönderdiniz. Lütfen ${waitSeconds} sn bekleyiniz.`, `Too many requests. Please wait ${waitSeconds} seconds.`));
            } else {
                setNotice(message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickActionClick = useCallback((action: MentorQuickAction) => {
        if (/studio\s*desk/i.test(`${action.label} ${action.prompt}`) && onNavigateStudioDesk) {
            onNavigateStudioDesk();
            return;
        }
        setInput(action.prompt);
    }, [onNavigateStudioDesk]);

    const handleDeleteChat = useCallback(async (chatId: string) => {
        if (deletingChatId === chatId) return;

        const chat = chats.find((entry) => entry.id === chatId);
        if (!chat) return;

        const confirmed = window.confirm(pickLocalized(language, `"${normalizeChatLabel(chat.title)}" sohbetini silmek istiyor musun?`, `Do you want to delete "${normalizeChatLabel(chat.title)}"?`));
        if (!confirmed) return;

        setDeletingChatId(chatId);
        setNotice(null);

        try {
            const response = await authedFetch('/api/mentor/chats', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ chatId }),
            });

            if (!response.ok) {
                throw await parseError(response);
            }

            const nextChats = await loadChats();
            const nextActive = nextChats[0] ?? null;

            if (nextActive) {
                setActiveChatId(nextActive.id);
            } else {
                const created = await createChat();
                setChats([created]);
                setActiveChatId(created.id);
            }

            setMessages([]);
            setQuickActions([]);
            setPendingAttachment(null);
            setBlockedDraftMessage(null);
            setShowPremiumLimitPrompt(false);
            setShowUpgradePrompt(false);
            setNotice(pickLocalized(language, 'Sohbet silindi.', 'Chat deleted.'));
        } catch (error) {
            setNotice(error instanceof Error ? error.message : pickLocalized(language, DEFAULT_MENTOR_ERROR, DEFAULT_MENTOR_ERROR_EN));
        } finally {
            setDeletingChatId(null);
        }
    }, [authedFetch, chats, createChat, deletingChatId, loadChats, parseError]);

    if (!isAuthenticated) {
        return (
            <div className="w-full max-w-4xl flex flex-col items-center justify-center p-12 bg-black/50 border border-white/10 rounded-xl">
                <AlertTriangle size={48} className="text-yellow-500 mb-4" />
                <h2 className="text-2xl font-display font-bold text-white mb-2 uppercase tracking-wide">{pickLocalized(language, 'AI Mentor için Giriş Gerekli', 'Sign-in required for AI Mentor')}</h2>
                <p className="text-slate-400 text-center mb-2">{pickLocalized(language, 'Mentor sohbetleri hesabına bağlı saklanır. Devam etmek için giriş yap.', 'Mentor chats are tied to your account. Sign in to continue.')}</p>
            </div>
        );
    }

    if (isAnonymous) {
        return (
            <div className="w-full max-w-4xl flex flex-col items-center justify-center p-12 bg-black/50 border border-white/10 rounded-xl">
                <AlertTriangle size={48} className="text-yellow-500 mb-4" />
                <h2 className="text-2xl font-display font-bold text-white mb-2 uppercase tracking-wide">{pickLocalized(language, 'AI Mentor Misafir Modunda Kapalı', 'AI Mentor is closed in guest mode')}</h2>
                <p className="text-slate-400 text-center mb-2">{pickLocalized(language, 'AI Mentor kullanımı için kayıtlı hesap gerekli.', 'A registered account is required to use AI Mentor.')}</p>
            </div>
        );
    }

    if (isBootstrapping) {
        return (
            <div className="w-full max-w-4xl flex items-center justify-center p-12 bg-black/50 border border-white/10 rounded-xl text-slate-300 font-mono">
                {pickLocalized(language, 'Sohbet yükleniyor...', 'Loading chat...')}
            </div>
        );
    }

    return (
        <motion.div
            key="ai-mentor"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-7xl h-[calc(100dvh-7.5rem)] grid grid-cols-1 lg:grid-cols-[300px_1fr] bg-[#111827] border border-emerald-500/30 rounded-xl overflow-hidden shadow-2xl relative"
        >
            <aside className="border-b lg:border-b-0 lg:border-r border-white/10 bg-[#0A0F1A]/90 flex flex-col min-h-0 max-h-[240px] sm:max-h-[260px] lg:max-h-none">
                <div className="p-4 border-b border-white/10">
                    <button
                        onClick={handleNewChat}
                        className="w-full py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                        <Plus size={16} /> {pickLocalized(language, 'Yeni Sohbet', 'New chat')}
                    </button>
                    <div className="mt-3 text-[11px] font-mono text-slate-400 flex items-center gap-2">
                        <span>{isPremiumUser ? 'Premium' : pickLocalized(language, 'Kayıtlı', 'Registered')}</span>
                        <div className="relative group inline-flex items-center">
                            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-500/60 text-[10px]">i</span>
                            <div className="pointer-events-none absolute left-0 top-6 z-30 hidden w-72 rounded-md border border-cyan-400/30 bg-[#0A0F1A] p-2 text-[10px] leading-relaxed text-cyan-100 group-hover:block">
                                {pickLocalized(language, `Sohbet başına ${isPremiumUser ? '12000' : '6000'} token. Her 1000 token kullanımında 3 Rapido düşülür.`, `Per chat: ${isPremiumUser ? '12000' : '6000'} tokens. 3 Rapido are deducted for every 1000 tokens used.`)}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {chats.map((chat) => (
                        <div key={chat.id} className="relative group">
                            <button
                                type="button"
                                onClick={() => setActiveChatId(chat.id)}
                                className={`w-full text-left rounded-lg border px-3 py-2 pr-10 transition-colors ${activeChatId === chat.id ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                            >
                                <p className="text-sm font-semibold text-white line-clamp-1">{normalizeChatLabel(chat.title)}</p>
                                <p className="text-[11px] text-slate-400 mt-1 font-mono">{new Date(chat.updatedAt).toLocaleString('tr-TR')}</p>
                            </button>
                            <button
                                type="button"
                                aria-label={pickLocalized(language, 'Sohbeti sil', 'Delete chat')}
                                onClick={() => void handleDeleteChat(chat.id)}
                                disabled={deletingChatId === chat.id}
                                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-400/30 bg-red-500/10 text-red-200 opacity-100 transition-colors hover:bg-red-500/20 disabled:opacity-50 md:opacity-0 md:group-hover:opacity-100"
                            >
                                {deletingChatId === chat.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                        </div>
                    ))}
                </div>
            </aside>

            <section className="flex flex-col min-h-0">
                <div className="p-4 border-b border-white/10 bg-black/20 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                            <Sparkles className="text-emerald-400" size={20} />
                        </div>
                        <div>
                            <h2 className="font-display font-bold text-lg text-white">AI Mentor</h2>
                            <p className="text-xs text-slate-400 font-mono">{pickLocalized(language, 'Sohbet token limiti:', 'Chat token limit:')} {activeChat ? activeChat.tokenLimit : '-'}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5 max-w-md">
                                {pickLocalized(
                                    language,
                                    'Sayılan değer: bu sohbetteki tüm mesajlarda kullanılan toplam token (girdi + çıktı, sağlayıcı kullanımı). Tek bir mesajın boyutu değildir.',
                                    'This counts total tokens used in this chat (input + output from the provider). It is not a single-message size.',
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="w-full sm:w-[260px]">
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-emerald-400" style={{ width: `${tokenPercent}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400 font-mono text-right">
                            {activeChat ? activeChat.tokensUsed : 0} / {activeChat ? activeChat.tokenLimit : 0}{' '}
                            {pickLocalized(language, 'toplam token', 'total tokens')}
                        </p>
                    </div>
                </div>

                {notice && (
                    <div className="mx-4 mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-100 text-sm">
                        {notice}
                    </div>
                )}

                {showUpgradePrompt && (
                    <div className="mx-4 mt-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-yellow-100 text-sm">
                        <p className="font-mono text-xs uppercase tracking-wider mb-2">{pickLocalized(language, 'Limit Uyarısı', 'Limit warning')}</p>
                        <p className="mb-3">{pickLocalized(language, 'Mentor kullanımına devam etmek için Premium plana geçebilir veya Rapido bakiyesi satın alabilirsin.', 'To keep using the mentor, you can upgrade to Premium or buy Rapido balance.')}</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onUpgradeClick?.()}
                                className="px-3 py-2 rounded border border-yellow-400/50 bg-yellow-500/20 text-yellow-50 text-xs font-mono uppercase tracking-wider hover:bg-yellow-500/30"
                            >
                                {pickLocalized(language, 'Premium Planları Gör', 'View Premium plans')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowUpgradePrompt(false)}
                                className="px-3 py-2 rounded border border-white/30 bg-white/10 text-slate-100 text-xs font-mono uppercase tracking-wider hover:bg-white/20"
                            >
                                {pickLocalized(language, 'Kapat', 'Close')}
                            </button>
                        </div>
                    </div>
                )}

                {showPremiumLimitPrompt && (
                    <div className="mx-4 mt-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 p-3 text-cyan-100 text-sm">
                        <p className="font-mono text-xs uppercase tracking-wider mb-2">{pickLocalized(language, 'Sohbet Limiti Doldu', 'Chat limit reached')}</p>
                        <p className="mb-3">{pickLocalized(language, 'Bu sohbeti kapatmadan devam etmek için 2 Rapido ile token limiti artırabilirsin.', 'You can extend the token limit with 2 Rapido to continue without closing this chat.')}</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => void handleSend({
                                    extendPremiumChat: true,
                                    forcedMessage: blockedDraftMessage ?? input,
                                })}
                                disabled={isLoading || !(blockedDraftMessage || input.trim())}
                                className="px-3 py-2 rounded border border-cyan-400/50 bg-cyan-500/20 text-cyan-50 text-xs font-mono uppercase tracking-wider hover:bg-cyan-500/30 disabled:opacity-50"
                            >
                                {pickLocalized(language, '2x Rapido ile Devam Et', 'Continue with 2x Rapido')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPremiumLimitPrompt(false);
                                    handleNewChat();
                                }}
                                className="px-3 py-2 rounded border border-white/30 bg-white/10 text-slate-100 text-xs font-mono uppercase tracking-wider hover:bg-white/20"
                            >
                                {pickLocalized(language, 'Yeni Sohbet Aç', 'Open new chat')}
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-1 min-h-0 p-4">
                    <div
                        ref={messagesContainerRef}
                        className="h-full overflow-y-auto p-4 space-y-6 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] lg:bg-fixed bg-scroll rounded-xl border border-white/5"
                    >
                    {messages.map((m) => (
                        <div key={m.id} className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${m.role === 'user' ? 'bg-white/10 text-slate-300' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'}`}>
                                {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                            </div>
                            <div className={`p-4 rounded-xl text-sm ${m.role === 'user' ? 'bg-white/10 text-white rounded-tr-none' : 'bg-black/50 text-slate-300 border border-emerald-500/20 rounded-tl-none prose prose-invert prose-emerald prose-sm'}`}>
                                {m.role === 'user' ? (
                                    <>
                                        <p>{m.text}</p>
                                        {m.attachmentName && (
                                            <p className="mt-2 text-[11px] text-cyan-200 font-mono">
                                                Ek: {m.attachmentUrl ? <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className="underline">{m.attachmentName}</a> : m.attachmentName}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <Markdown>{m.text}</Markdown>
                                )}
                                <p className="mt-2 text-[10px] opacity-60 font-mono">~{m.tokens} token</p>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-3 max-w-[85%]">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                                <Bot size={14} />
                            </div>
                            <div className="p-4 bg-black/50 rounded-xl rounded-tl-none border border-emerald-500/20">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 bg-emerald-500/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-emerald-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-emerald-500/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    {isMessagesLoading && !isLoading && (
                        <div className="text-xs text-slate-400 font-mono">{pickLocalized(language, 'Mesajlar yükleniyor...', 'Loading messages...')}</div>
                    )}
                    </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-[#0A0F1A]">
                    {quickActions.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                            {quickActions.map((action, index) => (
                                <button
                                    key={`${action.label}-${index}`}
                                    type="button"
                                    onClick={() => handleQuickActionClick(action)}
                                    className="px-3 py-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-xs font-mono hover:bg-emerald-500/20 transition-colors"
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {pendingAttachment && (
                        <div className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 text-xs font-mono">
                            <Paperclip size={14} />
                            {pendingAttachment.name} ({(pendingAttachment.sizeBytes / 1024).toFixed(0)} KB)
                            <button onClick={() => setPendingAttachment(null)} className="hover:text-white" aria-label={pickLocalized(language, 'Eki kaldır', 'Remove attachment')}>
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <label className="w-12 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg cursor-pointer transition-colors" title={pickLocalized(language, '2MB JPG/PNG/PDF ekle', 'Attach 2MB JPG/PNG/PDF') }>
                            <Paperclip size={18} className="text-slate-300" />
                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                className="hidden"
                                onChange={handleAttachmentChange}
                                disabled={isLoading}
                            />
                        </label>

                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder={pickLocalized(language, 'Mentora danış...', 'Ask the mentor...')}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                            disabled={isLoading}
                        />
                        <button
                            onClick={() => {
                                void handleSend();
                            }}
                            disabled={isLoading || !input.trim()}
                            className="w-12 flex items-center justify-center bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            </section>
        </motion.div>
    );
}
