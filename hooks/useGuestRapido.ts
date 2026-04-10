'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { TIER_DEFAULTS } from '@/lib/pricing';

const GUEST_ID_KEY = 'dod_guest_id';
const GUEST_RAPIDO_KEY = 'dod_guest_rapido';
const GUEST_FINGERPRINT_KEY = 'dod_guest_fp';

/**
 * Generates a simple browser fingerprint based on available signals.
 * Not cryptographic — designed to deter casual abuse.
 */
function generateFingerprint(): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let canvasHash = '';
    if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('DrawOrDie', 2, 2);
        canvasHash = canvas.toDataURL().slice(-50);
    }

    const signals = [
        navigator.language,
        screen.width.toString(),
        screen.height.toString(),
        screen.colorDepth.toString(),
        new Date().getTimezoneOffset().toString(),
        navigator.hardwareConcurrency?.toString() ?? '0',
        canvasHash,
    ];

    const raw = signals.join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return 'gfp_' + Math.abs(hash).toString(36);
}

function getOrCreateGuestId(): string {
    if (typeof window === 'undefined') return '';
    let guestId = localStorage.getItem(GUEST_ID_KEY);
    if (!guestId) {
        guestId = 'guest_' + crypto.randomUUID();
        localStorage.setItem(GUEST_ID_KEY, guestId);
    }
    return guestId;
}

function getStoredRapido(): number {
    if (typeof window === 'undefined') return TIER_DEFAULTS.GUEST;
    const saved = localStorage.getItem(GUEST_RAPIDO_KEY);
    if (saved !== null) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0) return parsed;
        localStorage.setItem(GUEST_RAPIDO_KEY, String(TIER_DEFAULTS.GUEST));
        return TIER_DEFAULTS.GUEST;
    }
    localStorage.setItem(GUEST_RAPIDO_KEY, String(TIER_DEFAULTS.GUEST));
    return TIER_DEFAULTS.GUEST;
}

function checkIsAbuser(): boolean {
    if (typeof window === 'undefined') return false;
    const savedFp = localStorage.getItem(GUEST_FINGERPRINT_KEY);
    const currentFp = generateFingerprint();
    localStorage.setItem(GUEST_FINGERPRINT_KEY, currentFp);
    return !!(savedFp && savedFp !== currentFp);
}

// Rapido store with subscription for useSyncExternalStore
let rapidoListeners: Array<() => void> = [];
let rapidoSnapshot = typeof window !== 'undefined' ? getStoredRapido() : TIER_DEFAULTS.GUEST;

function subscribeRapido(listener: () => void) {
    rapidoListeners.push(listener);
    return () => {
        rapidoListeners = rapidoListeners.filter(l => l !== listener);
    };
}

function getRapidoSnapshot() {
    return rapidoSnapshot;
}

function getServerRapidoSnapshot() {
    return TIER_DEFAULTS.GUEST;
}

// Module-level cached values (computed once on first import in browser)
let _cachedGuestId = '';
let _cachedFingerprint = '';
let _cachedIsAbuser = false;
let _initialized = false;

export function __resetGuestRapidoForTests() {
    rapidoListeners = [];
    rapidoSnapshot = typeof window !== 'undefined' ? getStoredRapido() : TIER_DEFAULTS.GUEST;
    _cachedGuestId = '';
    _cachedFingerprint = '';
    _cachedIsAbuser = false;
    _initialized = false;
}

function ensureInitialized() {
    if (_initialized || typeof window === 'undefined') return;
    _initialized = true;
    _cachedGuestId = getOrCreateGuestId();
    _cachedFingerprint = generateFingerprint();
    _cachedIsAbuser = checkIsAbuser();
}

export interface GuestState {
    guestId: string;
    fingerprint: string;
    rapidoPens: number;
    spendRapido: (amount: number) => boolean;
    isAbuser: boolean;
}

/**
 * Hook for managing guest (non-logged-in) user identity and rapido.
 * Uses localStorage + canvas fingerprint to prevent casual multi-account abuse.
 */
export function useGuestRapido(): GuestState {
    ensureInitialized();

    const rapidoPens = useSyncExternalStore(subscribeRapido, getRapidoSnapshot, getServerRapidoSnapshot);

    const spendRapido = useCallback((amount: number): boolean => {
        const current = getStoredRapido();
        if (current < amount) return false;
        const newAmount = current - amount;
        localStorage.setItem(GUEST_RAPIDO_KEY, String(newAmount));
        rapidoSnapshot = newAmount;
        for (const listener of rapidoListeners) listener();
        return true;
    }, []);

    return {
        guestId: _cachedGuestId,
        fingerprint: _cachedFingerprint,
        rapidoPens,
        spendRapido,
        isAbuser: _cachedIsAbuser,
    };
}
