'use client'

import React, { useState } from 'react'
import { ID } from 'appwrite'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/use-mobile'
import { X, Mail, Lock, LogIn, Loader2, Sparkles, User, ArrowLeft, RefreshCw } from 'lucide-react'
import { trackConversionEvent } from '@/lib/growth-tracking'
import { account } from '@/lib/appwrite'
import { canonicalizeAuthEmail, isValidEmailFormat } from '@/lib/auth-email'
import { useLanguage } from '@/components/RuntimeTextLocalizer'
import { REFERRAL_STORAGE_KEY } from '@/components/ReferralCapture'

export function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [mode, setMode] = useState<'login' | 'signup' | 'recovery'>('login')
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const { signInAnonymously, signInWithGoogle, reloadSession } = useAuth()
    const language = useLanguage()
    const isMobile = useIsMobile()

    const copy = language === 'en'
        ? {
            fullNameRequired: 'Full name is required.',
            verificationMailSent: 'Account created. Verification email sent, please check your inbox.',
            verificationMailFailedDomain: 'Verification email could not be sent. Add this domain to Appwrite Platform and check NEXT_PUBLIC_APP_URL.',
            verificationMailFailedGeneric: 'Verification email could not be sent. Check Appwrite email configuration.',
            emailRequired: 'Email is required.',
            emailInvalid: 'Please enter a valid email address.',
            gmailCanonicalConflict: 'This Gmail address (without dots) is already registered. Please log in or recover that account.',
            recoveryMailSent: 'Recovery email sent. Please check your inbox.',
            authErrorGeneric: 'An error occurred during authentication.',
            guestError: 'An error occurred entering as guest.',
            mobileGoogleDisabled: 'Google sign-in is temporarily disabled on mobile. Please use desktop.',
            googleStartFailed: 'Google sign-in could not be started.',
            titleLogin: 'Welcome Back',
            titleSignup: 'Join the Jury',
            titleRecovery: 'Reset Password',
            subtitleLogin: 'Log in to continue surviving.',
            subtitleSignup: 'Create an account to start submitting projects.',
            subtitleRecovery: 'We will send a password reset link to your email.',
            fullNameLabel: 'Full Name',
            fullNamePlaceholder: 'Full Name',
            passwordLabel: 'Password',
            forgotPassword: 'Forgot Password',
            signUp: 'Sign Up',
            backToLogin: 'Back to Login',
            logIn: 'Log In',
            sendRecoveryMail: 'Send Recovery Email',
            or: 'or',
            continueWithGoogle: 'Continue with Google',
            tryAsGuest: 'Try as Guest (1 Drawing)',
            guestModeLabel: 'Guest Mode:',
            guestModeText: 'Try one complete drawing to experience the jury. Create an account to save your work and unlock unlimited submissions.',
            dontHaveAccount: "Don't have an account?",
            alreadyHaveAccount: 'Already have an account?',
            needToGoBack: 'Need to go back?',
            googleAriaLabel: 'Sign in with Google',
            guestAriaLabel: 'Continue as guest with 1 drawing limit for trial',
            guestTitle: 'Try one drawing without creating an account',
        }
        : {
            fullNameRequired: 'Ad soyad zorunludur.',
            verificationMailSent: 'Hesap oluşturuldu. Doğrulama maili gönderildi, gelen kutunu kontrol et.',
            verificationMailFailedDomain: 'Dogrulama maili gonderilemedi. Appwrite Platform listesine bu domaini ekleyin ve NEXT_PUBLIC_APP_URL degerini kontrol edin.',
            verificationMailFailedGeneric: 'Dogrulama maili gonderilemedi. Appwrite email ayarlarini kontrol edin.',
            emailRequired: 'Email zorunludur.',
            emailInvalid: 'Gecerli bir email adresi gir.',
            gmailCanonicalConflict: 'Bu Gmail adresinin noktasiz surumu zaten kayitli. Lutfen giris yap veya sifre sifirla.',
            recoveryMailSent: 'Şifre sıfırlama maili gönderildi. Gelen kutunu kontrol et.',
            authErrorGeneric: 'Kimlik doğrulama sırasında bir hata oluştu.',
            guestError: 'Misafir girişinde bir hata oluştu.',
            mobileGoogleDisabled: 'Google ile giris mobilde gecici olarak inaktif. Sadece masaustunden Google ile giris yapabilirsiniz.',
            googleStartFailed: 'Google ile giriş başlatılamadı.',
            titleLogin: 'Tekrar Hoş Geldin',
            titleSignup: 'Jüriye Katıl',
            titleRecovery: 'Şifre Sıfırla',
            subtitleLogin: 'Hayatta kalmaya devam etmek için giriş yap.',
            subtitleSignup: 'Projelerini göndermeye başlamak için hesap oluştur.',
            subtitleRecovery: 'E-posta adresine şifre sıfırlama bağlantısı göndereceğiz.',
            fullNameLabel: 'Ad Soyad',
            fullNamePlaceholder: 'Ad Soyad',
            passwordLabel: 'Şifre',
            forgotPassword: 'Şifremi unuttum',
            signUp: 'Kayıt ol',
            backToLogin: 'Giriş ekranına dön',
            logIn: 'Giriş Yap',
            sendRecoveryMail: 'Sıfırlama Maili Gönder',
            or: 'veya',
            continueWithGoogle: 'Google ile Devam Et',
            tryAsGuest: 'Misafir Dene (1 Çizim)',
            guestModeLabel: 'Misafir Modu:',
            guestModeText: 'Jüriyi deneyimlemek için bir tam çizim dene. Çalışmanı kaydetmek ve sınırsız gönderim için hesap oluştur.',
            dontHaveAccount: 'Hesabın yok mu?',
            alreadyHaveAccount: 'Zaten hesabın var mı?',
            needToGoBack: 'Geri dönmek ister misin?',
            googleAriaLabel: 'Google ile giriş yap',
            guestAriaLabel: 'Deneme için 1 çizim sınırıyla misafir olarak devam et',
            guestTitle: 'Hesap oluşturmadan bir çizimi dene',
        }

    if (!isOpen) return null

    const resetTransientState = () => {
        setPassword('')
        setError(null)
        setNotice(null)
    }

    const goLogin = () => {
        setMode('login')
        resetTransientState()
    }

    const goSignup = () => {
        setMode('signup')
        resetTransientState()
    }

    const goRecovery = () => {
        setMode('recovery')
        resetTransientState()
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setNotice(null)

        try {
            const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : ''
            const runtimeHost = (() => {
                try {
                    return new URL(runtimeOrigin).hostname.toLowerCase()
                } catch {
                    return ''
                }
            })()
            const isLocalHost = runtimeHost === 'localhost' || runtimeHost === '127.0.0.1'
            const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
            const redirectBase = (!isLocalHost && configured && /^https?:\/\//i.test(configured)
                ? configured
                : runtimeOrigin
            ).replace(/\/$/, '')
            const verificationUrl = `${redirectBase}/auth/verify-email`
            const recoveryUrl = `${redirectBase}/auth/recovery`
            const emailResolution = canonicalizeAuthEmail(email)
            const canonicalEmail = emailResolution.canonicalEmail
            const fallbackEmail = emailResolution.normalizedEmail

            if (!fallbackEmail) {
                throw new Error(copy.emailRequired)
            }

            if (!isValidEmailFormat(fallbackEmail)) {
                throw new Error(copy.emailInvalid)
            }

            if (mode === 'login') {
                try {
                    await account.createEmailPasswordSession({ email: canonicalEmail, password })
                } catch (sessionError) {
                    if (emailResolution.gmailCanonicalized && fallbackEmail !== canonicalEmail) {
                        await account.createEmailPasswordSession({ email: fallbackEmail, password })
                    } else {
                        throw sessionError
                    }
                }
            } else if (mode === 'signup') {
                if (!fullName.trim()) {
                    throw new Error(copy.fullNameRequired)
                }

                const precheckResponse = await fetch('/api/auth/signup-precheck', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: fallbackEmail }),
                })

                const precheckPayload = await precheckResponse.json().catch(() => ({})) as {
                    error?: string
                    code?: string
                    canonicalEmail?: string
                }

                if (!precheckResponse.ok) {
                    if (precheckPayload.code === 'GMAIL_CANONICAL_CONFLICT') {
                        throw new Error(copy.gmailCanonicalConflict)
                    }

                    throw new Error(
                        typeof precheckPayload.error === 'string' && precheckPayload.error
                            ? precheckPayload.error
                            : copy.authErrorGeneric
                    )
                }

                const signupEmail = typeof precheckPayload.canonicalEmail === 'string' && precheckPayload.canonicalEmail
                    ? precheckPayload.canonicalEmail
                    : canonicalEmail

                await account.create({
                    userId: ID.unique(),
                    email: signupEmail,
                    password,
                    name: fullName.trim().substring(0, 128),
                })
                await account.createEmailPasswordSession({ email: signupEmail, password })
                try {
                    await account.createVerification(verificationUrl)
                } catch (verifyError) {
                    const rawMessage = verifyError instanceof Error ? verifyError.message : ''
                    if (/platform|domain|redirect|url/i.test(rawMessage)) {
                        throw new Error(copy.verificationMailFailedDomain)
                    }
                    throw new Error(rawMessage || copy.verificationMailFailedGeneric)
                }
                setNotice(copy.verificationMailSent)
                await trackConversionEvent('signup_completed', {
                    method: 'email',
                    product: 'draw_or_die',
                })

                // Referral kodu varsa bağla (hata olsa bile devam et)
                try {
                    const pendingCode = typeof window !== 'undefined'
                        ? window.localStorage.getItem(REFERRAL_STORAGE_KEY)
                        : null
                    if (pendingCode) {
                        const jwt = await account.createJWT()
                        const referralResponse = await fetch('/api/referral/link', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${jwt.jwt}`,
                            },
                            body: JSON.stringify({ referral_code: pendingCode }),
                        })
                        if (referralResponse.ok) {
                            window.localStorage.removeItem(REFERRAL_STORAGE_KEY)
                        }
                    }
                } catch {
                    // Referral hatası kayıt sürecini engellemez
                }
            } else {
                try {
                    await account.createRecovery(canonicalEmail, recoveryUrl)
                } catch (recoveryError) {
                    if (emailResolution.gmailCanonicalized && fallbackEmail !== canonicalEmail) {
                        await account.createRecovery(fallbackEmail, recoveryUrl)
                    } else {
                        throw recoveryError
                    }
                }
                setNotice(copy.recoveryMailSent)
            }

            window.dispatchEvent(new Event('appwrite-auth-changed'))
            await reloadSession()
            if (mode !== 'recovery') {
                onClose()
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : copy.authErrorGeneric

            if (mode === 'login' && /already|active|session/i.test(message)) {
                window.dispatchEvent(new Event('appwrite-auth-changed'))
                await reloadSession()
                onClose()
                return
            }

            setError(message)
        } finally {
            setLoading(false)
        }
    }

    const handleGuest = async () => {
        setLoading(true)
        setError(null)
        try {
            await signInAnonymously()
            onClose()
        } catch (err: any) {
            setError(err.message || copy.guestError)
        } finally {
            setLoading(false)
        }
    }

    const handleGoogle = async () => {
        if (isMobile) {
            setError(copy.mobileGoogleDisabled)
            return
        }

        setLoading(true)
        setError(null)
        try {
            await signInWithGoogle()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : copy.googleStartFailed
            setError(message)
            setLoading(false)
        }
    }

    const showAuthForm = mode !== 'recovery'

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#0A0F1A] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <div className="p-8">
                    <div className="text-center mb-8">
                        <h2 className="font-display font-bold text-2xl text-white mb-2">
                            {mode === 'login' ? copy.titleLogin : mode === 'signup' ? copy.titleSignup : copy.titleRecovery}
                        </h2>
                        <p className="text-slate-400 text-sm">
                            {mode === 'login'
                                ? copy.subtitleLogin
                                : mode === 'signup'
                                  ? copy.subtitleSignup
                                  : copy.subtitleRecovery}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-lg text-center">
                                {error}
                            </div>
                        )}

                        {mode === 'signup' && (
                            <div className="space-y-1">
                                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">{copy.fullNameLabel}</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-neon-red transition-colors"
                                        placeholder={copy.fullNamePlaceholder}
                                        required={mode === 'signup'}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">Email</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-neon-red transition-colors"
                                    placeholder="architect@studio.com"
                                    required
                                />
                            </div>
                        </div>

                        {showAuthForm && (
                            <div className="space-y-1">
                                <label className="text-xs font-mono text-slate-400 uppercase tracking-wider">{copy.passwordLabel}</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-neon-red transition-colors"
                                        placeholder="••••••••"
                                        required={mode === 'login' || mode === 'signup'}
                                    />
                                </div>
                            </div>
                        )}

                        {mode === 'login' && (
                            <div className="flex items-center justify-between gap-3 text-xs font-mono text-slate-400">
                                <button type="button" onClick={goRecovery} className="hover:text-white transition-colors">
                                    {copy.forgotPassword}
                                </button>
                                <button type="button" onClick={goSignup} className="hover:text-white transition-colors">
                                    {copy.signUp}
                                </button>
                            </div>
                        )}

                        {mode === 'signup' && (
                            <button
                                type="button"
                                onClick={goLogin}
                                className="w-full text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                            >
                                <ArrowLeft size={12} /> {copy.backToLogin}
                            </button>
                        )}

                        {mode === 'recovery' && (
                            <button
                                type="button"
                                onClick={goLogin}
                                className="w-full text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-2"
                            >
                                <ArrowLeft size={12} /> {copy.backToLogin}
                            </button>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-neon-red hover:bg-red-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : mode === 'recovery' ? <RefreshCw size={18} /> : <LogIn size={18} />}
                            {mode === 'login' ? copy.logIn : mode === 'signup' ? copy.signUp : copy.sendRecoveryMail}
                        </button>
                    </form>

                    {notice && (
                        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-100 text-sm">
                            {notice}
                        </div>
                    )}

                    <div className="mt-6 flex items-center gap-4">
                        <div className="h-[1px] flex-1 bg-white/10"></div>
                        <span className="text-xs font-mono text-slate-500 uppercase">{copy.or}</span>
                        <div className="h-[1px] flex-1 bg-white/10"></div>
                    </div>

                    <button
                        onClick={handleGoogle}
                        disabled={loading || isMobile}
                        className={`w-full mt-6 font-semibold text-sm py-3 rounded-lg border flex items-center justify-center gap-3 transition-colors disabled:opacity-80 ${isMobile
                            ? 'bg-slate-700/50 border-slate-500/40 text-slate-300 cursor-not-allowed'
                            : 'bg-white text-black hover:bg-slate-100 border-white/20'
                            }`}
                        aria-label={copy.googleAriaLabel}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 2.9 14.6 2 12 2 6.9 2 2.8 6.4 2.8 11.8S6.9 21.6 12 21.6c6.9 0 9.1-5 9.1-7.6 0-.5-.1-.9-.1-1.3H12z"/>
                        </svg>
                        {copy.continueWithGoogle}
                    </button>

                    {isMobile && (
                        <p className="mt-2 text-xs text-slate-400 text-center">
                            {copy.mobileGoogleDisabled}
                        </p>
                    )}

                    <button
                        onClick={handleGuest}
                        disabled={loading}
                        className="w-full mt-6 bg-white/5 hover:bg-white/10 text-white font-mono text-sm py-3 rounded-lg border border-white/10 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                        aria-label={copy.guestAriaLabel}
                        title={copy.guestTitle}
                    >
                        <Sparkles size={16} className="text-yellow-400" />
                        {copy.tryAsGuest}
                    </button>

                    <p className="text-center text-xs text-slate-500 mt-4 bg-slate-900/40 border border-slate-700/50 rounded-lg p-3">
                        <span className="font-bold text-slate-400">{copy.guestModeLabel}</span> {copy.guestModeText}
                    </p>

                    <p className="text-center text-sm text-slate-500 mt-6">
                        {mode === 'login' ? copy.dontHaveAccount : mode === 'signup' ? copy.alreadyHaveAccount : copy.needToGoBack}{' '}
                        <button
                            type="button"
                            onClick={() => {
                                if (mode === 'login') {
                                    goSignup()
                                } else {
                                    goLogin()
                                }
                            }}
                            className="text-white hover:text-neon-red font-bold transition-colors"
                        >
                            {mode === 'login' ? copy.signUp : copy.logIn}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )
}
