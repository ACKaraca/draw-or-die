'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDropHandler } from '@/hooks/useDropHandler';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useDrawOrDieStore, type Toast } from '@/stores/drawOrDieStore';
import { reportClientError } from '@/lib/logger';
import { resolvePathFromStep, resolveStepFromPath } from '@/lib/step-routing';
import { TIER_DEFAULTS } from '@/lib/pricing';

import { Header } from '@/components/Header';
import { AuthModal } from '@/components/AuthModal';
import { StepRouter } from '@/components/StepRouter';
import { normalizeLanguage, pickLocalized } from '@/lib/i18n';
import { useLanguage } from '@/components/RuntimeTextLocalizer';
import type { StepType } from '@/types';

const FORM_PERSIST_DEBOUNCE_MS = 400;
const FORM_SETTINGS_STORAGE_KEY = 'drawOrDieSettings';

/** `/?auth=signin` (or `?auth=1`) opens the auth modal; used by standalone pages' sign-in CTAs. */
const AUTH_OPEN_PARAM_VALUES: ReadonlySet<string> = new Set(['signin', '1']);

const TOAST_STYLES: Record<Toast['type'], { className: string; glyph: string }> = {
  info: { className: 'bg-blue-600/90 text-white', glyph: 'ℹ' },
  success: { className: 'bg-emerald-500/90 text-white', glyph: '✓' },
  error: { className: 'bg-red-600/90 text-white', glyph: '✕' },
  badge: { className: 'bg-yellow-500/90 text-black', glyph: '★' },
};

/** Full-height pages that should start below the header instead of vertical centering */
const TOP_ALIGNED_STEPS: ReadonlySet<StepType> = new Set([
  'gallery',
  'history',
  'profile',
  'account-details',
  'ai-mentor',
  'archbuilder',
  'premium-upgrade',
  'rapido-shop',
]);

const ROOT_PRESERVED_STEPS = new Set([
  'upload',
  'analyzing',
  'premium-analyzing',
  'result',
  'premium',
  'multi-analyzing',
  'multi-result',
]);

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const uiLanguage = useLanguage();
  const [routeHydrated, setRouteHydrated] = useState(false);
  const [multiJuryPromoActive, setMultiJuryPromoActive] = useState(false);

  // ---- Auth & rapido economy -----------------------------------------------
  const { user, profile, setProfile, refreshProfile, getJWT } = useAuth();
  const responseLanguage = normalizeLanguage(profile?.preferred_language, 'tr');

  const isPremiumUser = profile?.is_premium ?? false;
  const isAnonymous = user ? user.identities?.[0]?.provider === 'anonymous' : false; // P0.3: Guest mode
  const rapidoPens = user
    ? (profile?.rapido_pens ?? (isAnonymous ? TIER_DEFAULTS.ANONYMOUS : TIER_DEFAULTS.REGISTERED))
    : 0;
  const progressionScore = profile?.progression_score ?? 0;
  const earnedBadges = profile?.earned_badges ?? [];

  // ---- UI state from store --------------------------------------------------
  const {
    step,
    isAuthModalOpen,
    setIsAuthModalOpen,
    checkoutMessage,
    setCheckoutMessage,
    toasts,
    addToast,
    setCurrentGallery,
    setStep,
    goHome,
    setFormData,
    currentGallery,
  } = useDrawOrDieStore();

  useEffect(() => {
    const path = pathname || '/';
    const route = resolveStepFromPath(path);
    const currentStep = useDrawOrDieStore.getState().step;

    // Keep in-memory result/upload flows stable when root route is used as a shell.
    if (path === '/' && route.step === 'hero' && ROOT_PRESERVED_STEPS.has(currentStep)) {
      setRouteHydrated(true);
      return;
    }

    if (route.gallery) {
      setCurrentGallery(route.gallery);
    }

    if (useDrawOrDieStore.getState().step !== route.step) {
      setStep(route.step);
    }

    setRouteHydrated(true);
  }, [pathname, setCurrentGallery, setStep]);

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/feature-flags')
      .then((res) => res.json() as Promise<{ multiJuryPromo?: boolean }>)
      .then((data) => {
        if (!cancelled) setMultiJuryPromoActive(Boolean(data.multiJuryPromo));
      })
      .catch(() => {
        if (!cancelled) setMultiJuryPromoActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runtimeCopy = uiLanguage === 'en'
    ? {
      checkoutSuccess: 'Payment successful! Your Premium account is now active.',
      checkoutCancelled: 'Payment cancelled. You can try again anytime.',
      oauthFailed: 'Google sign-in could not be completed. Please try again.',
    }
    : uiLanguage === 'de'
      ? {
        checkoutSuccess: 'Zahlung erfolgreich! Ihr Premium-Konto ist jetzt aktiv.',
        checkoutCancelled: 'Zahlung abgebrochen. Sie können es jederzeit erneut versuchen.',
        oauthFailed: 'Die Anmeldung mit Google konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.',
      }
      : uiLanguage === 'it'
        ? {
          checkoutSuccess: 'Pagamento riuscito! Il tuo account Premium è ora attivo.',
          checkoutCancelled: 'Pagamento annullato. Puoi riprovare in qualsiasi momento.',
          oauthFailed: 'L’accesso con Google non è stato completato. Riprova.',
        }
        : {
          checkoutSuccess: 'Ödeme başarılı! Premium hesabınız aktif edildi.',
          checkoutCancelled: 'Ödeme iptal edildi. İstediğiniz zaman tekrar deneyebilirsiniz.',
          oauthFailed: 'Google ile giriş tamamlanamadı. Lütfen tekrar deneyin.',
        };

  useEffect(() => {
    if (!routeHydrated) return;

    const nextPath = resolvePathFromStep(step, currentGallery);
    if ((pathname || '/') === nextPath) return;

    router.push(nextPath);
  }, [currentGallery, pathname, routeHydrated, router, step]);

  // ---- Stripe / OAuth / auth-modal redirect handling ----------------------
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkoutStatus = params.get('checkout');
    const authStatus = params.get('auth');
    if (checkoutStatus === 'success') {
      setCheckoutMessage(runtimeCopy.checkoutSuccess);
      refreshProfile();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (checkoutStatus === 'cancelled') {
      addToast(runtimeCopy.checkoutCancelled, 'error');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (authStatus === 'oauth_failed') {
      let errStr = params.get('error_description') || params.get('error') || params.get('code') || '';
      if (errStr) {
        try {
          errStr = decodeURIComponent(errStr);
        } catch {
          // Keep the raw value; it is only used for matching and server-side logging.
        }
        // Provider errors are technical (and often English); log them for us instead of showing them to users.
        void reportClientError({ scope: 'auth.oauth_failed', message: errStr.slice(0, 500) });
      }

      const isAccountExists = errStr.toLowerCase().includes('already exists') || errStr.toLowerCase().includes('conflict');
      const detailMsg = isAccountExists
        ? ` ${pickLocalized(
          uiLanguage,
          'Bu e-posta ile kayıtlı bir hesap zaten var. Lütfen e-posta ve şifrenle giriş yap.',
          'An account with this email already exists. Please sign in with your email and password.',
        )}`
        : '';

      addToast(runtimeCopy.oauthFailed + detailMsg, 'error', 7000);
      window.history.replaceState({}, '', window.location.pathname);
      if (isAccountExists) setIsAuthModalOpen(true);
    } else if (authStatus && AUTH_OPEN_PARAM_VALUES.has(authStatus)) {
      setIsAuthModalOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [
    refreshProfile,
    runtimeCopy.checkoutCancelled,
    runtimeCopy.checkoutSuccess,
    runtimeCopy.oauthFailed,
    setCheckoutMessage,
    setIsAuthModalOpen,
    addToast,
    uiLanguage,
  ]);

  // Capture uncaught browser errors and mirror them into server-side site logs.
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void reportClientError({
        scope: 'window.error',
        message: event.message || 'Unhandled error',
        details: {
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error instanceof Error ? event.error.stack : null,
        },
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      void reportClientError({
        scope: 'window.unhandledrejection',
        message: 'Unhandled promise rejection',
        details: {
          reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
          stack: event.reason instanceof Error ? event.reason.stack : null,
        },
      });
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  // ---- Persist form data to localStorage -----------------------------------
  const formData = useDrawOrDieStore((s) => s.formData);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(FORM_SETTINGS_STORAGE_KEY);
      if (saved) setFormData(JSON.parse(saved));
    } catch {
      // Corrupt or blocked storage: keep the store defaults.
    }
    // Restore once on mount only; setFormData is a stable store action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // Debounced so typing in the upload form does not serialize + write storage on every keystroke.
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(FORM_SETTINGS_STORAGE_KEY, JSON.stringify(formData));
      } catch {
        // Quota exceeded / private mode: persistence is best-effort.
      }
    }, FORM_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [formData]);

  // ---- File drop handler ---------------------------------------------------
  const { getRootProps, getInputProps, isDragActive } = useDropHandler({
    isPremiumUser,
    preferredLanguage: responseLanguage,
  });

  // ---- AI analysis handlers ------------------------------------------------
  const {
    handleAnalyze,
    handleMultiAnalyze,
    handlePremium,
    handleAutoConcept,
    handleMaterialBoard,
    handleDesignInsight,
    handleDefenseSubmit,
    handleGalleryConsent,
    handlePreserveAnalysis,
    handleShareToCommunity,
  } = useAnalysis({
    user,
    profile,
    isPremiumUser,
    rapidoPens,
    getJWT,
    refreshProfile,
    setProfile,
    preferredLanguage: responseLanguage,
    multiJuryPromoActive,
  });

  const errorToasts = toasts.filter((toast) => toast.type === 'error');
  const statusToasts = toasts.filter((toast) => toast.type !== 'error');
  const renderToast = (toast: Toast) => {
    const style = TOAST_STYLES[toast.type] ?? TOAST_STYLES.info;
    return (
      <div
        key={toast.id}
        className={`px-[18px] py-3 rounded-[10px] font-mono text-xs max-w-[400px] text-center ${style.className}`}
      >
        <span aria-hidden="true" className="mr-2">{style.glyph}</span>
        {toast.message}
      </div>
    );
  };

  const shellJustify = TOP_ALIGNED_STEPS.has(step) ? 'justify-start' : 'justify-center';

  return (
    <div className={`min-h-screen w-full flex flex-col items-center ${shellJustify} pt-[64px] p-4`}>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Stripe checkout banner */}
      {checkoutMessage && (
        <div
          role="status"
          className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-500/90 text-white font-mono text-sm rounded-lg shadow-lg flex items-center gap-3"
        >
          <span>{checkoutMessage}</span>
          <button
            type="button"
            onClick={() => setCheckoutMessage(null)}
            className="text-white/70 hover:text-white text-lg leading-none"
            aria-label={pickLocalized(uiLanguage, 'Bildirimi kapat', 'Dismiss notification')}
          >
            &times;
          </button>
        </div>
      )}

      {/* Toast stack — sits above the cookie banner; live regions stay mounted so screen readers announce updates.
          Exempt from modal inerting so toasts raised while a dialog is open are still announced. */}
      <div
        data-inert-exempt=""
        className="fixed left-1/2 -translate-x-1/2 z-[110] flex flex-col gap-2 items-center pointer-events-none w-[calc(100%-32px)] max-w-[400px]"
        style={{ bottom: 'calc(24px + var(--cookie-banner-h, 0px))' }}
      >
        <div role="status" aria-live="polite" className="flex flex-col gap-2 items-center">
          {statusToasts.map(renderToast)}
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2 items-center">
          {errorToasts.map(renderToast)}
        </div>
      </div>

      <Header
        goHome={goHome}
        setCurrentGallery={setCurrentGallery}
        setStep={setStep}
        onAuthClick={() => setIsAuthModalOpen(true)}
      />

      <StepRouter
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        isAuthenticated={Boolean(user)}
        userId={user?.id ?? null}
        onAuthRequired={() => setIsAuthModalOpen(true)}
        isPremiumUser={isPremiumUser}
        isAnonymous={isAnonymous}
        rapidoPens={rapidoPens}
        progressionScore={progressionScore}
        earnedBadges={earnedBadges}
        preferredLanguage={responseLanguage}
        multiJuryPromoActive={multiJuryPromoActive}
        handleAnalyze={handleAnalyze}
        handleMultiAnalyze={handleMultiAnalyze}
        handlePremium={handlePremium}
        handleAutoConcept={handleAutoConcept}
        handleMaterialBoard={handleMaterialBoard}
        handleDesignInsight={handleDesignInsight}
        handleDefenseSubmit={handleDefenseSubmit}
        handleGalleryConsent={handleGalleryConsent}
        handlePreserveAnalysis={handlePreserveAnalysis}
        handleShareToCommunity={handleShareToCommunity}
      />
    </div>
  );
}
