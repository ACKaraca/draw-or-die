'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ID } from 'appwrite'
import { useAuth } from '@/hooks/useAuth'
import { useIsMobile } from '@/hooks/use-mobile'
import { X, Mail, Lock, LogIn, Loader2, Sparkles, User, ArrowLeft, RefreshCw } from 'lucide-react'
import { trackConversionEvent } from '@/lib/growth-tracking'
import { account } from '@/lib/appwrite'
import { canonicalizeAuthEmail, isValidEmailFormat } from '@/lib/auth-email'
import { reportClientError } from '@/lib/logger'
import { useLanguage } from '@/components/RuntimeTextLocalizer'
import { REFERRAL_STORAGE_KEY } from '@/components/ReferralCapture'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
const DIALOG_TITLE_ID = 'auth-modal-title'

/** Validation errors we raise ourselves; their message is already user-facing copy. */
class AuthFlowError extends Error {}

type AuthErrorCopy = {
    invalidCredentials: string
    userExists: string
    userNotFound: string
    rateLimited: string
    passwordInvalid: string
    passwordPersonalData: string
    emailInvalid: string
    userBlocked: string
    network: string
    authErrorGeneric: string
}

function readErrorFields(error: unknown): { type: string, code: number, message: string } {
    if (typeof error !== 'object' || error === null) return { type: '', code: 0, message: '' }
    const candidate = error as { type?: unknown, code?: unknown, message?: unknown }
    return {
        type: typeof candidate.type === 'string' ? candidate.type : '',
        code: typeof candidate.code === 'number' ? candidate.code : 0,
        message: typeof candidate.message === 'string' ? candidate.message : '',
    }
}

/** Maps Appwrite / network errors to localized copy; raw SDK messages are English and technical. */
function describeAuthError(error: unknown, copy: AuthErrorCopy): string {
    if (error instanceof AuthFlowError) return error.message

    const { type, code, message } = readErrorFields(error)
    if (type === 'user_invalid_credentials') return copy.invalidCredentials
    if (type === 'user_already_exists' || type === 'user_email_already_exists' || code === 409) return copy.userExists
    if (type === 'user_not_found' || code === 404) return copy.userNotFound
    if (type === 'general_rate_limit_exceeded' || code === 429) return copy.rateLimited
    if (type === 'password_personal_data') return copy.passwordPersonalData
    const isArgumentError = type === 'general_argument_invalid' || code === 400
    if (type === 'password_recently_used' || (isArgumentError && /password/i.test(message))) return copy.passwordInvalid
    if (isArgumentError && /email/i.test(message)) return copy.emailInvalid
    if (type === 'user_blocked') return copy.userBlocked
    if (code === 401) return copy.invalidCredentials
    if (error instanceof TypeError || /network|failed to fetch|load failed/i.test(message)) return copy.network
    return copy.authErrorGeneric
}

export function AuthModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const [mode, setMode] = useState<'login' | 'signup' | 'recovery'>('login')
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)
    const [isNoticeWarning, setIsNoticeWarning] = useState(false)
    const [isSignupComplete, setIsSignupComplete] = useState(false)
    const dialogRef = useRef<HTMLDivElement | null>(null)
    const continueButtonRef = useRef<HTMLButtonElement | null>(null)
    const closeHandlerRef = useRef<() => void>(onClose)

    const { signInAnonymously, signInWithGoogle, reloadSession } = useAuth()
    const isMobile = useIsMobile()
    const language = useLanguage()

    const copy = language !== 'tr'
        ? {
            fullNameRequired: 'Full name is required.',
            verificationMailSent: 'Account created. We sent a verification link to your email; open it to verify your account.',
            verificationMailFailed: 'Your account is ready and you are signed in, but we could not send the verification email right now. If this keeps happening, contact us via the Feedback form at the bottom of the page.',
            emailRequired: 'Email is required.',
            emailInvalid: 'Please enter a valid email address.',
            gmailCanonicalConflict: 'This Gmail address (without dots) is already registered. Please log in or recover that account.',
            recoveryMailSent: 'Recovery email sent. Please check your inbox.',
            authErrorGeneric: 'Something went wrong while signing in. Please try again.',
            invalidCredentials: 'Email or password is incorrect. Check them and try again.',
            userExists: 'An account with this email already exists. Log in instead, or reset your password.',
            userNotFound: 'No account found with this email. Check the address or sign up.',
            rateLimited: 'Too many attempts. Wait a few minutes and try again.',
            passwordInvalid: 'Password must be 8–256 characters and must not be a commonly used password.',
            passwordPersonalData: 'Password must not contain your name or email address.',
            userBlocked: 'This account is disabled. Contact us via the Feedback form at the bottom of the page.',
            network: 'Connection problem. Check your internet connection and try again.',
            guestError: 'Guest mode could not be started. Please try again in a moment.',
            googleStartFailed: 'Google sign-in could not be started. Please try again.',
            signupCompleteTitle: 'Account Created',
            continueCta: 'Continue',
            closeLabel: 'Close',
            emailLabel: 'Email',
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
            mobileGoogleDisabled: 'Google sign-in is temporarily disabled on mobile. Please use desktop.',
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
            verificationMailSent: 'Hesabın oluşturuldu. E-posta adresine bir doğrulama bağlantısı gönderdik; hesabını doğrulamak için bağlantıyı aç.',
            verificationMailFailed: 'Hesabın hazır ve giriş yaptın; ancak doğrulama e-postasını şu anda gönderemedik. Sorun devam ederse sayfanın altındaki Geri Bildirim formundan bize ulaş.',
            emailRequired: 'E-posta adresi zorunludur.',
            emailInvalid: 'Geçerli bir e-posta adresi gir.',
            gmailCanonicalConflict: 'Bu Gmail adresinin noktasız sürümü zaten kayıtlı. Lütfen giriş yap veya şifreni sıfırla.',
            recoveryMailSent: 'Şifre sıfırlama e-postası gönderildi. Gelen kutunu kontrol et.',
            authErrorGeneric: 'Giriş sırasında bir sorun oluştu. Lütfen tekrar dene.',
            invalidCredentials: 'E-posta veya şifre hatalı. Kontrol edip tekrar dene.',
            userExists: 'Bu e-posta ile kayıtlı bir hesap zaten var. Giriş yap veya şifreni sıfırla.',
            userNotFound: 'Bu e-posta ile kayıtlı bir hesap bulunamadı. Adresi kontrol et veya kayıt ol.',
            rateLimited: 'Çok fazla deneme yapıldı. Birkaç dakika bekleyip tekrar dene.',
            passwordInvalid: 'Şifre 8–256 karakter olmalı ve yaygın kullanılan bir şifre olmamalı.',
            passwordPersonalData: 'Şifre adını veya e-posta adresini içermemeli.',
            userBlocked: 'Bu hesap devre dışı. Sayfanın altındaki Geri Bildirim formundan bize ulaş.',
            network: 'Bağlantı sorunu. İnternet bağlantını kontrol edip tekrar dene.',
            guestError: 'Misafir modu başlatılamadı. Lütfen biraz sonra tekrar dene.',
            googleStartFailed: 'Google ile giriş başlatılamadı. Lütfen tekrar dene.',
            signupCompleteTitle: 'Hesabın Oluşturuldu',
            continueCta: 'Devam Et',
            closeLabel: 'Kapat',
            emailLabel: 'E-posta',
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
            mobileGoogleDisabled: 'Google ile giriş mobilde geçici olarak kapalı. Lütfen masaüstü kullan.',
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

    const handleClose = () => {
        setPassword('')
        setError(null)
        setNotice(null)
        setIsNoticeWarning(false)
        setIsSignupComplete(false)
        setMode('login')
        onClose()
    }

    // Kept in a ref so the focus effect below does not re-run (and steal focus) on every parent render.
    useEffect(() => {
        closeHandlerRef.current = handleClose
    })

    useEffect(() => {
        if (!isOpen) return

        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const dialog = dialogRef.current
        dialog?.querySelector<HTMLElement>('input:not([disabled])')?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                closeHandlerRef.current()
                return
            }
            if (event.key !== 'Tab' || !dialog) return

            const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            const active = document.activeElement
            if (event.shiftKey && (active === first || !dialog.contains(active))) {
                event.preventDefault()
                last?.focus()
            } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
                event.preventDefault()
                first?.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            previouslyFocused?.focus()
        }
    }, [isOpen])

    useEffect(() => {
        if (isSignupComplete) continueButtonRef.current?.focus()
    }, [isSignupComplete])

    if (!isOpen) return null

    const resetTransientState = () => {
        setPassword('')
        setError(null)
        setNotice(null)
        setIsNoticeWarning(false)
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
            const redirectBase = (typeof window !== 'undefined' ? window.location.origin : '').replace(/\/$/, '')
            const verificationUrl = `${redirectBase}/auth/verify-email`
            const recoveryUrl = `${redirectBase}/auth/recovery`
            const emailResolution = canonicalizeAuthEmail(email)
            const canonicalEmail = emailResolution.canonicalEmail
            const fallbackEmail = emailResolution.normalizedEmail

            if (!fallbackEmail) {
                throw new AuthFlowError(copy.emailRequired)
            }

            if (!isValidEmailFormat(fallbackEmail)) {
                throw new AuthFlowError(copy.emailInvalid)
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
                    throw new AuthFlowError(copy.fullNameRequired)
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
                    // The precheck API returns Turkish-only copy, so map by status/code instead of showing it.
                    if (precheckPayload.code === 'GMAIL_CANONICAL_CONFLICT') {
                        throw new AuthFlowError(copy.gmailCanonicalConflict)
                    }
                    if (precheckResponse.status === 400) {
                        throw new AuthFlowError(copy.emailInvalid)
                    }
                    if (precheckResponse.status === 429) {
                        throw new AuthFlowError(copy.rateLimited)
                    }

                    throw new AuthFlowError(copy.authErrorGeneric)
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
                    setNotice(copy.verificationMailSent)
                    setIsNoticeWarning(false)
                } catch (verifyError) {
                    // The account and session already exist, so this is a soft failure. Configuration details
                    // (e.g. Appwrite platform/domain, NEXT_PUBLIC_APP_URL) go to server logs, not to the user.
                    void reportClientError({
                        scope: 'auth.signup.verification_email',
                        message: verifyError instanceof Error ? verifyError.message : 'Verification email failed',
                    })
                    setNotice(copy.verificationMailFailed)
                    setIsNoticeWarning(true)
                }
                setIsSignupComplete(true)
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
            // Sign-up keeps the modal open on a confirmation view so the "check your inbox" notice is seen.
            if (mode === 'login') {
                handleClose()
            }
        } catch (err: unknown) {
            const { type, message: rawMessage } = readErrorFields(err)
            const hasActiveSession = type === 'user_session_already_exists'
                || (!(err instanceof AuthFlowError) && /already|active|session/i.test(rawMessage))

            if (mode === 'login' && hasActiveSession) {
                window.dispatchEvent(new Event('appwrite-auth-changed'))
                await reloadSession()
                handleClose()
                return
            }

            setError(describeAuthError(err, copy))
        } finally {
            setLoading(false)
        }
    }

    const handleGuest = async () => {
        setLoading(true)
        setError(null)
        try {
            await signInAnonymously()
            handleClose()
        } catch (err: unknown) {
            const described = describeAuthError(err, copy)
            setError(described === copy.authErrorGeneric ? copy.guestError : described)
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
            const described = describeAuthError(err, copy)
            setError(described === copy.authErrorGeneric ? copy.googleStartFailed : described)
            setLoading(false)
        }
    }

    const showAuthForm = mode !== 'recovery'

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={DIALOG_TITLE_ID}
                className="bg-[#0A0F1A] border border-white/10 rounded-2xl w-full max-w-md max-h-[calc(100dvh-32px)] overflow-y-auto shadow-2xl relative"
            >
                <button
                    type="button"
                    onClick={handleClose}
                    aria-label={copy.closeLabel}
                    title={copy.closeLabel}
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                >
                    <X size={20} aria-hidden="true" />
                </button>

                {isSignupComplete ? (
                    <div className="p-8 text-center">
                        <h2 id={DIALOG_TITLE_ID} className="font-display font-bold text-2xl text-white mb-4">
                            {copy.signupCompleteTitle}
                        </h2>
                        <div
                            role="status"
                            className={`rounded-lg border p-4 text-sm text-left leading-relaxed ${isNoticeWarning
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'}`}
                        >
                            <Mail size={16} className="inline mr-2 -mt-0.5" aria-hidden="true" />
                            {notice}
                        </div>
                        <button
                            ref={continueButtonRef}
                            type="button"
                            onClick={handleClose}
                            className="mt-6 w-full bg-neon-red hover:bg-red-600 text-white font-mono font-bold uppercase tracking-wider text-sm py-3 rounded-lg transition-colors"
                        >
                            {copy.continueCta}
                        </button>
                    </div>
                ) : (
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h2 id={DIALOG_TITLE_ID} className="font-display font-bold text-2xl text-white mb-2">
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
                            <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-lg text-center">
                                {error}
                            </div>
                        )}

                        {mode === 'signup' && (
                            <div className="space-y-1">
                                <label htmlFor="auth-full-name" className="text-xs font-mono text-slate-400 uppercase tracking-wider">{copy.fullNameLabel}</label>
                                <div className="relative">
                                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                    <input
                                        id="auth-full-name"
                                        type="text"
                                        autoComplete="name"
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
                            <label htmlFor="auth-email" className="text-xs font-mono text-slate-400 uppercase tracking-wider">{copy.emailLabel}</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                <input
                                    id="auth-email"
                                    type="email"
                                    autoComplete="email"
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
                                <label htmlFor="auth-password" className="text-xs font-mono text-slate-400 uppercase tracking-wider">{copy.passwordLabel}</label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                    <input
                                        id="auth-password"
                                        type="password"
                                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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
                        <div role="status" className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-100 text-sm">
                            {notice}
                        </div>
                    )}

                    <div className="mt-6 flex items-center gap-4">
                        <div className="h-[1px] flex-1 bg-white/10"></div>
                        <span className="text-xs font-mono text-slate-500 uppercase">{copy.or}</span>
                        <div className="h-[1px] flex-1 bg-white/10"></div>
                    </div>

                    <button
                        type="button"
                        onClick={handleGoogle}
                        disabled={loading || isMobile}
                        className="w-full mt-6 font-semibold text-sm py-3 rounded-lg border flex items-center justify-center gap-3 transition-colors disabled:opacity-80 bg-white text-black hover:bg-slate-100 border-white/20"
                        aria-label={copy.googleAriaLabel}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 2.9 14.6 2 12 2 6.9 2 2.8 6.4 2.8 11.8S6.9 21.6 12 21.6c6.9 0 9.1-5 9.1-7.6 0-.5-.1-.9-.1-1.3H12z"/>
                        </svg>
                        {copy.continueWithGoogle}
                    </button>

                    {isMobile && (
                        <p className="mt-3 text-center text-xs text-slate-400">
                            {copy.mobileGoogleDisabled}
                        </p>
                    )}

                    <button
                        type="button"
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
                )}
            </div>
        </div>
    )
}
