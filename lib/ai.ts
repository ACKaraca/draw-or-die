import { account } from '@/lib/appwrite';
import { OperationType } from '@/lib/pricing';
import type { Badge } from '@/types';
import { reportClientError } from '@/lib/logger';
import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

export interface AICallOptions {
    operation: OperationType | 'PREMIUM_RESCUE' | 'AUTO_FILL_FORM';
    imageBase64?: string;
    imageMimeType?: string;
    params?: Record<string, unknown>;
    /** Locale for user-facing error strings and Accept-Language on the API request. */
    locale?: SupportedLanguage;
}

export interface GameStateUpdate {
    progression_score: number;
    wall_of_death_count: number;
    earned_badges: Badge[];
    new_badges: Badge[];
}

export interface AIResponse {
    result: string;
    rapido_remaining: number;
    game_state?: GameStateUpdate;
}

export interface AIError {
    error: string;
    code?: 'PREMIUM_REQUIRED' | 'INSUFFICIENT_RAPIDO' | 'RATE_LIMITED' | 'AI_PROVIDER_FAILURE' | 'AI_PROVIDER_CREDITS_REQUIRED' | 'CHAT_TOKEN_LIMIT_REACHED' | 'MENTOR_PREMIUM_LIMIT_REACHED' | 'GUEST_MENTOR_DISABLED';
    required?: number;
    available?: number;
    waitSeconds?: number;
    providerStatus?: number;
    requestId?: string;
    status?: number;
}

const AI_TIMEOUT_MS = 120_000;

const formatStructuredAIError = (err: AIError, lang: SupportedLanguage): Error => {
    if (err.code === 'PREMIUM_REQUIRED') {
        return new Error('PREMIUM_REQUIRED');
    }
    if (err.code === 'INSUFFICIENT_RAPIDO') {
        return new Error(`INSUFFICIENT_RAPIDO:${err.required ?? ''}:${err.available ?? ''}`);
    }
    if (err.code === 'RATE_LIMITED') {
        const waitSeconds = Number.isFinite(err.waitSeconds) ? Math.max(1, Math.ceil(Number(err.waitSeconds))) : 60;
        return new Error(`RATE_LIMITED:${waitSeconds}`);
    }
    if (err.code === 'CHAT_TOKEN_LIMIT_REACHED') {
        return new Error('CHAT_TOKEN_LIMIT_REACHED');
    }
    if (err.code === 'MENTOR_PREMIUM_LIMIT_REACHED') {
        return new Error('MENTOR_PREMIUM_LIMIT_REACHED');
    }
    if (err.code === 'GUEST_MENTOR_DISABLED') {
        return new Error('GUEST_MENTOR_DISABLED');
    }
    if (err.code === 'AI_PROVIDER_FAILURE') {
        const providerStatus = Number.isFinite(err.providerStatus) ? Number(err.providerStatus) : err.status;
        const unknown = pickLocalized(lang, 'bilinmiyor', 'unknown');
        return new Error(
            pickLocalized(
                lang,
                `AI sağlayıcısı geçici bir hata döndürdü (${providerStatus ?? unknown}). Lütfen tekrar deneyin.`,
                `The AI provider returned a temporary error (${providerStatus ?? unknown}). Please try again.`,
            ),
        );
    }
    if (err.code === 'AI_PROVIDER_CREDITS_REQUIRED') {
        return new Error(
            pickLocalized(
                lang,
                'AI sağlayıcısında ücretsiz kredi erişimi geçici olarak kısıtlı. Lütfen daha sonra tekrar deneyin.',
                'The AI provider has temporarily restricted free-credit access. Please try again later.',
            ),
        );
    }

    const requestIdSuffix = err.requestId
        ? pickLocalized(lang, ` (İstek ID: ${err.requestId})`, ` (Request ID: ${err.requestId})`)
        : '';
    if (typeof err.error === 'string' && err.error.trim()) {
        return new Error(`${err.error.trim()}${requestIdSuffix}`);
    }
    if (typeof err.status === 'number') {
        return new Error(
            pickLocalized(
                lang,
                `AI servisi HTTP ${err.status} hatası döndürdü.${requestIdSuffix}`,
                `AI service returned HTTP ${err.status}.${requestIdSuffix}`,
            ),
        );
    }
    return new Error(`${pickLocalized(lang, 'API hatası', 'API error')}${requestIdSuffix}`);
};

const tryExtractEdgeError = async (error: unknown): Promise<AIError | null> => {
    if (!error || typeof error !== 'object') return null;

    const candidate = error as {
        context?: {
            status?: number;
            json?: () => Promise<AIError>;
            text?: () => Promise<string>;
        };
        message?: string;
    };

    if (candidate.context?.json) {
        try {
            const payload = await candidate.context.json();
            return {
                ...payload,
                status: payload.status ?? candidate.context.status,
            };
        } catch {
            // Fallback to text/message parsing below.
        }
    }

    if (candidate.context?.text) {
        try {
            const text = await candidate.context.text();
            return {
                error: text,
                status: candidate.context.status,
            };
        } catch {
            // Ignore and fallback to message.
        }
    }

    if (candidate.message) {
        return {
            error: candidate.message,
            status: candidate.context?.status,
        };
    }

    return null;
};

/**
 * Calls AI via internal Next.js API route authenticated with Appwrite JWT.
 *
 * Returns the full AIResponse object (result string + rapido_remaining + optional game_state).
 * game_state is present for operations that mutate game data server-side
 * (SINGLE_JURY, REVISION_SAME, DEFENSE).
 */
export const generateAIResponse = async (options: AICallOptions): Promise<AIResponse | null> => {
    const lang: SupportedLanguage = options.locale ?? 'tr';
    let jwt: string;
    try {
        const jwtRes = await account.createJWT();
        jwt = jwtRes.jwt;
    } catch {
        throw new Error(pickLocalized(lang, 'Oturum bulunamadı. Lütfen giriş yapın.', 'No session found. Please sign in.'));
    }

    const invokePromise = (async () => {
        try {
            const res = await fetch('/api/ai-generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                    'Accept-Language': lang === 'en' ? 'en' : 'tr',
                },
                body: JSON.stringify({
                    operation: options.operation,
                    imageBase64: options.imageBase64,
                    imageMimeType: options.imageMimeType,
                    params: options.params || {},
                }),
            });

            if (!res.ok) {
                const err = new Error(`AI route failed with status ${res.status}`) as Error & {
                    context?: {
                        status: number;
                        json: () => Promise<AIError>;
                        text: () => Promise<string>;
                    };
                };

                err.context = {
                    status: res.status,
                    json: async () => {
                        const payload = await res.clone().json().catch(() => null);
                        if (payload && typeof payload === 'object') {
                            return {
                                ...(payload as AIError),
                                status: res.status,
                            };
                        }
                        return {
                            error: await res.clone().text(),
                            status: res.status,
                        };
                    },
                    text: async () => await res.clone().text(),
                };

                return { data: null, error: err };
            }

            const data = await res.json();
            return { data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AbortError')), AI_TIMEOUT_MS)
    );

    try {
        const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as {
            data: Record<string, unknown> | null;
            error: unknown;
        };

        if (error) {
            const edgeErr = await tryExtractEdgeError(error);
            if (edgeErr) throw formatStructuredAIError(edgeErr, lang);

            const rawMsg =
                typeof error === 'object' && error !== null && 'message' in error
                    ? (error as { message?: unknown }).message
                    : error;
            const errMsg = typeof rawMsg === 'string' ? rawMsg : String(rawMsg ?? '');
            if (errMsg.includes('PREMIUM_REQUIRED')) throw new Error('PREMIUM_REQUIRED');
            if (errMsg.includes('INSUFFICIENT_RAPIDO')) throw new Error(errMsg);
            if (errMsg.includes('RATE_LIMITED')) throw new Error(errMsg);
            throw new Error(errMsg || pickLocalized(lang, 'API hatası', 'API error'));
        }

        const res = data as Record<string, unknown>;
        if (res && 'error' in res && res.error) {
            const code = res.code;
            const codeStr = typeof code === 'string' || typeof code === 'number' ? String(code) : '';
            if (codeStr === 'PREMIUM_REQUIRED') throw new Error('PREMIUM_REQUIRED');
            if (codeStr === 'INSUFFICIENT_RAPIDO') {
                throw new Error(`INSUFFICIENT_RAPIDO:${res.required}:${res.available}`);
            }
            throw new Error(String(res.error));
        }

        if (!res?.result) return null;

        return {
            result: res.result as string,
            rapido_remaining: (res.rapido_remaining as number) ?? 0,
            game_state: res.game_state as GameStateUpdate | undefined,
        };
    } catch (err) {
        if (err instanceof Error) {
            if (err.message === 'AbortError') {
                throw new Error(pickLocalized(lang, 'İstek zaman aşımına uğradı. Tekrar deneyin.', 'Request timed out. Try again.'));
            }
            if (/HTTP\s*413|status\s*413/i.test(err.message)) {
                throw new Error(
                    pickLocalized(lang, 'Dosya çok büyük. Lütfen daha küçük bir dosya deneyin.', 'File is too large. Try a smaller file.'),
                );
            }
            if (/failed to fetch|networkerror|load failed/i.test(err.message)) {
                void reportClientError({
                    scope: 'ai.generate.fetch',
                    message: 'Fetch failed for AI request',
                    details: {
                        operation: options.operation,
                        error: err.message,
                    },
                });
                throw new Error(
                    pickLocalized(
                        lang,
                        'Bağlantı hatası oluştu veya dosya çok büyük. Dosyayı küçültüp tekrar deneyin.',
                        'Connection failed or file is too large. Reduce the file size and try again.',
                    ),
                );
            }
            throw err;
        }
        throw new Error(pickLocalized(lang, 'Beklenmeyen hata.', 'Unexpected error.'));
    }
};
