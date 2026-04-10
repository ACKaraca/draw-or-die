/**
 * Rate limiter for Next.js API routes.
 *
 * Uses Upstash Redis (sliding window) when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are set. Falls back gracefully to an in-memory
 * Map so the app stays functional without Redis credentials.
 *
 * The in-memory fallback resets on serverless cold starts and does NOT
 * share state across instances — it is intentionally only a last resort.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitConfig {
    /** Max requests allowed in the window */
    maxRequests: number;
    /** Window duration in milliseconds */
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

// ─── Upstash Redis initialisation (lazy, singleton) ──────────────────────────

let _redis: Redis | null = null;
// Map from window-size string → Ratelimit instance, e.g. "10:60000" → instance
const _limiters = new Map<string, Ratelimit>();

function getRedis(): Redis | null {
    if (typeof window !== 'undefined') return null; // client-side guard
    if (_redis) return _redis;

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;

    try {
        _redis = new Redis({ url, token });
        return _redis;
    } catch {
        return null;
    }
}

function getLimiter(config: RateLimitConfig): Ratelimit | null {
    const redis = getRedis();
    if (!redis) return null;

    const key = `${config.maxRequests}:${config.windowMs}`;
    if (_limiters.has(key)) return _limiters.get(key)!;

    const windowSeconds = Math.ceil(config.windowMs / 1000);
    const limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSeconds}s`),
        prefix: 'dod:rl',
    });
    _limiters.set(key, limiter);
    return limiter;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const memStore = new Map<string, RateLimitEntry>();

// Clean stale entries every 5 minutes
if (typeof setInterval !== 'undefined') {
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [k, entry] of memStore) {
            if (now > entry.resetAt) memStore.delete(k);
        }
    }, 5 * 60 * 1000);

    if (typeof cleanupInterval.unref === 'function') {
        cleanupInterval.unref();
    }
}

function checkRateLimitInMemory(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const entry = memStore.get(key);

    if (!entry || now > entry.resetAt) {
        memStore.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
    }

    if (entry.count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count += 1;
    return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

// ─── Public API ───────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: RateLimitConfig = {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
};

/**
 * Check rate limit for a given key.
 * Async to support Redis; the in-memory fallback resolves immediately.
 */
export async function checkRateLimit(
    key: string,
    config: RateLimitConfig = DEFAULT_CONFIG
): Promise<RateLimitResult> {
    const limiter = getLimiter(config);

    if (limiter) {
        try {
            const result = await limiter.limit(key);
            return {
                allowed: result.success,
                remaining: result.remaining,
                resetAt: result.reset,
            };
        } catch (err) {
            // Fail open — Redis errors should not block users
            console.error('[rate-limit] Redis error, falling back to in-memory:', err);
        }
    }

    return checkRateLimitInMemory(key, config);
}

// Preset configs for different endpoints
export const RATE_LIMITS = {
    /** AI operations — more restrictive */
    AI_OPERATION: { maxRequests: 2, windowMs: 60 * 1000 } as RateLimitConfig,
    /** AI mentor chat — higher conversational allowance */
    AI_MENTOR: { maxRequests: 6, windowMs: 60 * 1000 } as RateLimitConfig,
    /** Checkout — prevent spam */
    CHECKOUT: { maxRequests: 5, windowMs: 60 * 1000 } as RateLimitConfig,
    /** General API — lenient */
    GENERAL: { maxRequests: 60, windowMs: 60 * 1000 } as RateLimitConfig,
} as const;

/** Test helper: clear in-memory store between unit tests. */
export function __resetRateLimitStore() {
    memStore.clear();
}
