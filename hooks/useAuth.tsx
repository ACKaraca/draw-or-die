'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { OAuthProvider } from 'appwrite'
import { account } from '@/lib/appwrite'
import { Badge } from '@/types'
import type { SupportedLanguage } from '@/lib/i18n'

const AUTH_SESSION_HINT_KEY = 'dod_has_appwrite_session'

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
}

type AuthContextType = {
    user: AppUser | null
    session: AppSession | null
    profile: UserProfile | null
    loading: boolean
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
    signInAnonymously: async () => { },
    signInWithGoogle: async () => { },
    refreshProfile: async () => { },
    reloadSession: async () => { },
    signOut: async () => { },
    setPreferredLanguage: async () => { },
    setProfile: () => { }
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AppUser | null>(null)
    const [session, setSession] = useState<AppSession | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

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

    const hasSessionHint = useCallback(() => {
        if (typeof window === 'undefined') return false
        try {
            if (window.localStorage.getItem(AUTH_SESSION_HINT_KEY) === '1') {
                return true
            }

            if (/a_session_[^=]+=/.test(document.cookie || '')) {
                return true
            }

            for (let i = 0; i < window.localStorage.length; i += 1) {
                const key = window.localStorage.key(i) || ''
                if (/cookiefallback/i.test(key)) {
                    const value = window.localStorage.getItem(key)
                    if (value) {
                        return true
                    }
                }
            }
        } catch {
            return false
        }

        return false
    }, [])

    const createJwtWithRetry = useCallback(async () => {
        try {
            return await account.createJWT()
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 220))
            return account.createJWT()
        }
    }, [])

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

    const refreshSession = useCallback(async (force = true) => {
        setLoading(true)

        if (!force && !hasSessionHint()) {
            setUser(null)
            setSession(null)
            setProfile(null)
            setLoading(false)
            return
        }

        try {
            const currentUser = await account.get()
            const jwt = await createJwtWithRetry()
            const mappedUser = mapUser(currentUser)
            const nextSession: AppSession = {
                access_token: jwt.jwt,
                user: mappedUser,
            }

            setUser(mappedUser)
            setSession(nextSession)
            await fetchProfile(nextSession.access_token)
            setSessionHint(true)
        } catch {
            setUser(null)
            setSession(null)
            setProfile(null)
            setSessionHint(false)
        } finally {
            setLoading(false)
        }
    }, [createJwtWithRetry, fetchProfile, hasSessionHint, mapUser, setSessionHint])

    const reloadSession = useCallback(async () => {
        await refreshSession(true)
    }, [refreshSession])

    useEffect(() => {
        const onAuthChanged = () => {
            void refreshSession(true)
        }

        void refreshSession(false)
        window.addEventListener('appwrite-auth-changed', onAuthChanged)

        return () => {
            window.removeEventListener('appwrite-auth-changed', onAuthChanged)
        }
    }, [refreshSession])

    const refreshProfile = async () => {
        if (!user) {
            return
        }

        try {
            const jwt = await createJwtWithRetry()
            setSession((prev) =>
                prev
                    ? { ...prev, access_token: jwt.jwt }
                    : { access_token: jwt.jwt, user }
            )
            await fetchProfile(jwt.jwt)
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
            await refreshSession(true)
        } catch (error) {
            console.error('Error signing in anonymously:', error)
            setLoading(false)
        }
    }

    const signInWithGoogle = async () => {
        const runtimeOrigin = window.location.origin
        const host = (() => {
            try {
                return new URL(runtimeOrigin).hostname.toLowerCase()
            } catch {
                return ''
            }
        })()
        const isLocalHost = host === 'localhost' || host === '127.0.0.1'
        const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
        const origin = !isLocalHost && configured && /^https?:\/\//i.test(configured)
            ? configured.replace(/\/$/, '')
            : runtimeOrigin
        await account.createOAuth2Session({
            provider: OAuthProvider.Google,
            success: `${origin}/`,
            failure: `${origin}/?auth=oauth_failed`,
        })
    }

    const signOut = async () => {
        try {
            await account.deleteSession('current')
        } finally {
            setUser(null)
            setSession(null)
            setProfile(null)
            setLoading(false)
            setSessionHint(false)
            window.dispatchEvent(new Event('appwrite-auth-changed'))
        }
    }

    const setPreferredLanguage = useCallback(async (language: SupportedLanguage) => {
        const nextLanguage: SupportedLanguage = language === 'en' ? 'en' : 'tr'

        setProfile((prev) => (prev ? { ...prev, preferred_language: nextLanguage } : prev))

        if (!user) {
            return
        }

        try {
            const jwt = await createJwtWithRetry()
            setSession((prev) =>
                prev
                    ? { ...prev, access_token: jwt.jwt }
                    : prev
            )

            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwt.jwt}`,
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
    }, [createJwtWithRetry, setSessionHint, user])

    return (
        <AuthContext.Provider value={{ user, session, profile, loading, signInAnonymously, signInWithGoogle, refreshProfile, reloadSession, signOut, setPreferredLanguage, setProfile }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
