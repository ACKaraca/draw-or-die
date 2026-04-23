'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { OAuthProvider } from 'appwrite'
import { account } from '@/lib/appwrite'
import type { Badge } from '@/types'
import { normalizeLanguage, type SupportedLanguage } from '@/lib/i18n'

const AUTH_SESSION_HINT_KEY = 'dod_has_appwrite_session'
const JWT_CACHE_TTL_MS = 45_000
const JWT_RETRY_ATTEMPTS = 3
const JWT_RETRY_BASE_MS = 160

type IdleWindow = Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
    cancelIdleCallback?: (handle: number) => void
}

export type UserProfile = {
    id: string
    email: string | null
    preferred_language?: SupportedLanguage
    is_premium: boolean
    rapido_pens: number
    progression_score: number
    wall_of_death_count: number
    earned_badges: Badge[]
    stripe_customer_id?: string | null
    stripe_subscription_id?: string | null
    subscription_status?: string | null
    subscription_current_period_start?: string | null
    subscription_current_period_end?: string | null
    subscription_cancel_at_period_end?: boolean
    premium_started_at?: string | null
    premium_price_cents?: number | null
    premium_currency?: string | null
    premium_interval?: string | null
    premium_promo_code?: string | null
    edu_verified?: boolean
    edu_email?: string | null
    edu_verification_email?: string | null
    edu_verification_expires?: string | null
    referral_code?: string | null
    referred_by?: string | null
    referral_rewarded_at?: string | null
    referral_signup_count?: number
}

type AuthContextType = {
    user: AppUser | null
    session: AppSession | null
    profile: UserProfile | null
    loading: boolean
    getJWT: () => Promise<string>
    signInAnonymously: () => Promise<void>
    signInWithGoogle: () => Promise<void>
    refreshProfile: () => Promise<void>
    reloadSession: () => Promise<void>
    signOut: () => Promise<void>
    setPreferredLanguage: (language: SupportedLanguage) => Promise<void>
    setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>
}

export type AppUser = {
    id: string
    email: string | null
    name?: string | null
    identities?: Array<{ provider: string }>
}

export type AppSession = {
    access_token: string
    user: AppUser
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    getJWT: async () => {
        throw new Error('AuthProvider not initialized')
    },
    signInAnonymously: async () => { },
    signInWithGoogle: async () => { },
    refreshProfile: async () => { },
    reloadSession: async () => { },
    signOut: async () => { },
    setPreferredLanguage: async () => { },
    setProfile: () => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AppUser | null>(null)
    const [session, setSession] = useState<AppSession | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    const userRef = useRef<AppUser | null>(null)
    const sessionRef = useRef<AppSession | null>(null)
    const jwtCacheRef = useRef<{ token: string; expiresAt: number } | null>(null)
    const jwtInflightRef = useRef<Promise<string> | null>(null)
    const warmPrefetchUserIdRef = useRef<string | null>(null)
    const resourceValidationUserIdRef = useRef<string | null>(null)

    useEffect(() => {
        userRef.current = user
        sessionRef.current = session
    }, [session, user])

    const setSessionHint = useCallback((hasSession: boolean) => {
        if (typeof window === 'undefined') return
        try {
            if (hasSession) {
                window.localStorage.setItem(AUTH_SESSION_HINT_KEY, '1')
            } else {
                window.localStorage.removeItem(AUTH_SESSION_HINT_KEY)
            }
        } catch {
            // Ignore storage errors.
        }
    }, [])

    const clearJwtCache = useCallback(() => {
        jwtCacheRef.current = null
        jwtInflightRef.current = null
    }, [])

    const createJwtWithRetry = useCallback(async () => {
        let lastError: unknown = null

        for (let attempt = 0; attempt < JWT_RETRY_ATTEMPTS; attempt += 1) {
            try {
                return await account.createJWT()
            } catch (error) {
                lastError = error

                if (attempt >= JWT_RETRY_ATTEMPTS - 1) {
                    break
                }

                const waitMs = JWT_RETRY_BASE_MS * (2 ** attempt)
                await new Promise((resolve) => setTimeout(resolve, waitMs))
            }
        }

        throw (lastError instanceof Error ? lastError : new Error('JWT generation failed'))
    }, [])

    const getJWT = useCallback(async (): Promise<string> => {
        const now = Date.now()
        const cached = jwtCacheRef.current
        if (cached && cached.expiresAt > now) {
            return cached.token
        }

        if (jwtInflightRef.current) {
            return await jwtInflightRef.current
        }

        const tokenPromise = (async () => {
            const jwt = await createJwtWithRetry()
            const token = jwt.jwt

            jwtCacheRef.current = {
                token,
                expiresAt: Date.now() + JWT_CACHE_TTL_MS,
            }

            setSession((prev) => (prev ? { ...prev, access_token: token } : prev))
            setSessionHint(true)

            return token
        })()

        jwtInflightRef.current = tokenPromise

        try {
            return await tokenPromise
        } finally {
            if (jwtInflightRef.current === tokenPromise) {
                jwtInflightRef.current = null
            }
        }
    }, [createJwtWithRetry, setSessionHint])

    const mapUser = useCallback((rawUser: { $id: string; email?: string | null; name?: string | null }): AppUser => {
        const provider = rawUser.email ? 'email' : 'anonymous'
        return {
            id: rawUser.$id,
            email: rawUser.email ?? null,
            name: rawUser.name ?? null,
            identities: [{ provider }],
        }
    }, [])

    const fetchProfile = useCallback(async (accessToken: string) => {
        const res = await fetch('/api/profile', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })

        if (!res.ok) {
            setProfile(null)
            return
        }

        const payload = await res.json() as { profile?: UserProfile }

        if (payload.profile) {
            setProfile(payload.profile)
        }
    }, [])

    const clearAuthState = useCallback(() => {
        setUser(null)
        setSession(null)
        setProfile(null)
        clearJwtCache()
        setSessionHint(false)
    }, [clearJwtCache, setSessionHint])

    const refreshSession = useCallback(async () => {
        setLoading(true)

        try {
            const currentUser = await account.get()
            const mappedUser = mapUser(currentUser)
            const existingSession = sessionRef.current

            let accessToken: string | null = null
            try {
                accessToken = await getJWT()
            } catch {
                if (existingSession?.user.id === mappedUser.id && existingSession.access_token) {
                    accessToken = existingSession.access_token
                }
            }

            if (!accessToken) {
                throw new Error('JWT_SESSION_UNAVAILABLE')
            }

            const nextSession: AppSession = {
                access_token: accessToken,
                user: mappedUser,
            }

            setUser(mappedUser)
            setSession(nextSession)
            setSessionHint(true)
            await fetchProfile(accessToken)
        } catch {
            const activeUser = userRef.current
            const activeSession = sessionRef.current
            const hasActiveUiState = Boolean(activeUser && activeSession?.access_token)

            if (!hasActiveUiState) {
                clearAuthState()
            }
        } finally {
            setLoading(false)
        }
    }, [clearAuthState, fetchProfile, getJWT, mapUser, setSessionHint])

    const reloadSession = useCallback(async () => {
        await refreshSession()
    }, [refreshSession])

    useEffect(() => {
        const onAuthChanged = () => {
            void refreshSession()
        }

        void refreshSession()
        window.addEventListener('appwrite-auth-changed', onAuthChanged)

        return () => {
            window.removeEventListener('appwrite-auth-changed', onAuthChanged)
        }
    }, [refreshSession])

    useEffect(() => {
        const activeUser = userRef.current
        if (!activeUser) {
            warmPrefetchUserIdRef.current = null
            resourceValidationUserIdRef.current = null
            return
        }

        if (warmPrefetchUserIdRef.current === activeUser.id) {
            return
        }

        warmPrefetchUserIdRef.current = activeUser.id
        let cancelled = false

        const prefetch = async () => {
            try {
                const jwt = await getJWT()
                const headers = { Authorization: `Bearer ${jwt}` }
                await fetch('/api/profile/stats', { headers })
            } catch {
                // Prefetch should not affect foreground auth state.
            }
        }

        const win = window as IdleWindow
        if (typeof win.requestIdleCallback === 'function') {
            const idleHandle = win.requestIdleCallback(() => {
                if (!cancelled) {
                    void prefetch()
                }
            }, { timeout: 1500 })

            return () => {
                cancelled = true
                if (typeof win.cancelIdleCallback === 'function') {
                    win.cancelIdleCallback(idleHandle)
                }
            }
        }

        const timeoutHandle = window.setTimeout(() => {
            if (!cancelled) {
                void prefetch()
            }
        }, 900)

        return () => {
            cancelled = true
            window.clearTimeout(timeoutHandle)
        }
    }, [getJWT, user])

    useEffect(() => {
        const activeUser = userRef.current
        if (!activeUser) {
            return
        }

        if (resourceValidationUserIdRef.current === activeUser.id) {
            return
        }

        resourceValidationUserIdRef.current = activeUser.id
        let cancelled = false

        const validateResources = async () => {
            try {
                const jwt = await getJWT()
                await fetch('/api/health/appwrite', {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                })
            } catch {
                // Validation is best-effort and should never block auth or UX.
            }
        }

        const win = window as IdleWindow
        if (typeof win.requestIdleCallback === 'function') {
            const idleHandle = win.requestIdleCallback(() => {
                if (!cancelled) {
                    void validateResources()
                }
            }, { timeout: 3000 })

            return () => {
                cancelled = true
                if (typeof win.cancelIdleCallback === 'function') {
                    win.cancelIdleCallback(idleHandle)
                }
            }
        }

        const timeoutHandle = window.setTimeout(() => {
            if (!cancelled) {
                void validateResources()
            }
        }, 1500)

        return () => {
            cancelled = true
            window.clearTimeout(timeoutHandle)
        }
    }, [getJWT, user])

    const refreshProfile = async () => {
        const activeUser = userRef.current
        if (!activeUser) {
            return
        }

        try {
            const jwt = await getJWT()
            setSession((prev) =>
                prev
                    ? { ...prev, access_token: jwt }
                    : { access_token: jwt, user: activeUser }
            )
            await fetchProfile(jwt)
            setSessionHint(true)
        } catch {
            await reloadSession()
        }
    }

    const signInAnonymously = async () => {
        setLoading(true)
        try {
            await account.createAnonymousSession()
            window.dispatchEvent(new Event('appwrite-auth-changed'))
            await refreshSession()
        } catch (error) {
            console.error('Error signing in anonymously:', error)
            setLoading(false)
        }
    }

    const signInWithGoogle = async () => {
        const runtimeOrigin = window.location.origin.replace(/\/$/, '')
        // OAuth redirect performs a full page navigation. Set hint first so mount-time
        // session restoration does not get skipped after returning from provider.
        setSessionHint(true)
        try {
            await account.createOAuth2Session({
                provider: OAuthProvider.Google,
                success: `${runtimeOrigin}/`,
                failure: `${runtimeOrigin}/?auth=oauth_failed`,
            })
        } catch (error) {
            setSessionHint(false)
            throw error
        }
    }

    const signOut = async () => {
        try {
            await account.deleteSession('current')
        } finally {
            clearAuthState()
            setLoading(false)
            window.dispatchEvent(new Event('appwrite-auth-changed'))
        }
    }

    const setPreferredLanguage = useCallback(async (language: SupportedLanguage) => {
        const nextLanguage = normalizeLanguage(language, 'tr')

        setProfile((prev) => (prev ? { ...prev, preferred_language: nextLanguage } : prev))

        const activeUser = userRef.current
        if (!activeUser) {
            return
        }

        try {
            const jwt = await getJWT()
            setSession((prev) =>
                prev
                    ? { ...prev, access_token: jwt }
                    : prev
            )

            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt}`,
                },
                body: JSON.stringify({ preferred_language: nextLanguage }),
            })

            if (!res.ok) {
                throw new Error('Failed to update profile language')
            }

            const payload = await res.json() as { profile?: UserProfile }
            if (payload.profile) {
                setProfile(payload.profile)
            }
            setSessionHint(true)
        } catch {
            // Keep optimistic local language even if backend update fails.
        }
    }, [getJWT, setSessionHint])

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                profile,
                loading,
                getJWT,
                signInAnonymously,
                signInWithGoogle,
                refreshProfile,
                reloadSession,
                signOut,
                setPreferredLanguage,
                setProfile,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
