// Rapido costs per AI operation
export const RAPIDO_COSTS = {
    SINGLE_JURY: 4,          // Tek jüri analizi, pafta başına
    REVISION_SAME: 1,        // Revizyon (aynı proje onaylı)
    REVISION_DIFFERENT: 2,   // Revizyon (farklı proje tespit edildi)
    MULTI_JURY: 10,          // Çoklu jüri, pafta başına (Premium)
    MULTI_JURY_REVISION: 2,  // Çoklu jüri revizyon (Premium)
    AUTO_CONCEPT: 5,         // Otomatik konsept üretimi
    MATERIAL_BOARD: 3,       // Malzeme analizi (Premium)
    DEFENSE: 4,              // Jüri savunması (Premium)
    AI_MENTOR: 1,            // AI Mentor mesaj başına (Premium)
    PREMIUM_RESCUE: 6,       // Premium kurtarma analizi (3x artirildi)
} as const;

// Hidden AI mentor billing (token -> rapido).
// User-facing UI should not expose this conversion directly.
export const AI_MENTOR_BILLING = {
    TOKENS_PER_UNIT: 15000,
    RAPIDO_PER_UNIT: 5,
    MIN_CHARGE: 0.01,
} as const;

// Tier default rapido amounts
export const TIER_DEFAULTS = {
    GUEST: 4,        // Giriş yapmayan (tek test analizi)
    ANONYMOUS: 4,    // Anonim session
    REGISTERED: 15,  // Email ile kayıtlı
    PREMIUM: 200,    // Premium abone
} as const;

// Premium-only features
export const PREMIUM_FEATURES = [
    'MULTI_JURY',
    'MULTI_JURY_REVISION',
    'MATERIAL_BOARD',
    'DEFENSE',
    'AI_MENTOR',
] as const;

export type OperationType = keyof typeof RAPIDO_COSTS;

export function isPremiumOnly(operation: OperationType): boolean {
    return PREMIUM_FEATURES.includes(operation as any);
}

export function isEduTrEmail(email: string): boolean {
    return email.toLowerCase().endsWith('.edu.tr');
}

export function isAkdenizStudentEmail(email: string): boolean {
    const normalized = email.trim().toLowerCase();
    return normalized.endsWith('@akdeniz.edu.tr') || normalized.endsWith('.akdeniz.edu.tr');
}

export type StripeTierKey = 'AKDENIZ_STUDENT' | 'TR_STUDENT' | 'GLOBAL';

export function resolveStripeTierByEmail(email: string): StripeTierKey {
    if (isAkdenizStudentEmail(email)) return 'AKDENIZ_STUDENT';
    if (isEduTrEmail(email)) return 'TR_STUDENT';
    return 'GLOBAL';
}

export function resolveStripeTierForUser(options: {
    primaryEmail?: string | null;
    eduVerified?: boolean;
    eduEmail?: string | null;
}): StripeTierKey {
    const eduEmail = (options.eduEmail || '').trim().toLowerCase();
    if (options.eduVerified && eduEmail) {
        return resolveStripeTierByEmail(eduEmail);
    }

    return resolveStripeTierByEmail((options.primaryEmail || '').trim().toLowerCase());
}

// Stripe pricing
export const STRIPE_PRICES = {
    AKDENIZ_STUDENT: {
        MONTHLY: 14900,  // 149 TL in kurus
        YEARLY: 124900,  // 1249 TL in kurus
        RAPIDO_UNIT: 395, // 3.95 TL in kurus
        CURRENCY: 'try' as const,
        PRICE_IDS: {
            MONTHLY: 'price_1TJfYNR9Q18j8gkWmautm7FE',
            YEARLY: 'price_1TJfYNR9Q18j8gkWvvYK7AR6',
            RAPIDO: 'price_1TJfYNR9Q18j8gkWcOF1H7yN',
        },
        PRODUCT_ID: 'prod_U6U8NXOAvuRcFL',
    },
    TR_STUDENT: {
        MONTHLY: 29900,  // 299 TL in kuruş
        YEARLY: 249900,  // 2499 TL in kuruş
        RAPIDO_UNIT: 395, // 3.95 TL in kuruş
        CURRENCY: 'try' as const,
        PRICE_IDS: {
            MONTHLY: 'price_1TJfaeR9Q18j8gkWiJSpecEP',
            YEARLY: 'price_1TJfafR9Q18j8gkWATTSoYr5',
            RAPIDO: 'price_1TJfaeR9Q18j8gkWngMJI5yc',
        },
        PRODUCT_ID: 'prod_U6U8NXOAvuRcFL',
    },
    GLOBAL: {
        MONTHLY: 1500,   // $15 in cents
        YEARLY: 12900,   // $129 in cents
        RAPIDO_UNIT: 79, // $0.79 in cents
        CURRENCY: 'usd' as const,
        PRICE_IDS: {
            MONTHLY: 'price_1TJfaeR9Q18j8gkWZcIira9l',
            YEARLY: 'price_1TJfaeR9Q18j8gkWD3lH0zoU',
            RAPIDO: 'price_1TJfaeR9Q18j8gkWLFU14ZxI',
        },
        PRODUCT_ID: 'prod_U6U8oTE0BWkND3',
    },
    RAPIDO_PRODUCT_ID: 'prod_U6U8yxnUXmfYYw',
    MIN_RAPIDO_PURCHASE: 5,
} as const;
