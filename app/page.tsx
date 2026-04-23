'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useDropHandler } from '@/hooks/useDropHandler';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import { reportClientError } from '@/lib/logger';
import { resolvePathFromStep, resolveStepFromPath } from '@/lib/step-routing';
import { TIER_DEFAULTS } from '@/lib/pricing';

import { Header } from '@/components/Header';
import { AuthModal } from '@/components/AuthModal';
import { StepRouter } from '@/components/StepRouter';
import { normalizeLanguage, pickLocalized, type SupportedLanguage } from '@/lib/i18n';
import type { StepType } from '@/types';

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
  const routeHydratedRef = useRef(false);
  const [clientLanguage] = useState<SupportedLanguage>(() => {
    if (typeof window === 'undefined') return 'tr';

    const stored = window.localStorage.getItem('dod_preferred_language');
    if (stored) return normalizeLanguage(stored, 'tr');

    return normalizeLanguage(window.navigator.language, 'tr');
  });
  const [multiJuryPromoActive, setMultiJuryPromoActive] = useState(false);

  // ---- Auth & rapido economy -----------------------------------------------
  const { user, profile, setProfile, refreshProfile, getJWT } = useAuth();

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
      routeHydratedRef.current = true;
      return;
    }

    if (route.gallery) {
      setCurrentGallery(route.gallery);
    }

    if (useDrawOrDieStore.getState().step !== route.step) {
      setStep(route.step);
    }

    routeHydratedRef.current = true;
  }, [pathname, setCurrentGallery, setStep]);

  const preferredLanguage = normalizeLanguage(profile?.preferred_language, clientLanguage);

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

  const runtimeCopy = {
    checkoutSuccess: pickLocalized(
      preferredLanguage,
      'Ödeme başarılı! Premium hesabınız aktif edildi.',
      'Payment successful! Your Premium account is now active.',
    ),
    checkoutCancelled: pickLocalized(
      preferredLanguage,
      'Ödeme iptal edildi. İstediğiniz zaman tekrar deneyebilirsiniz.',
      'Payment cancelled. You can try again anytime.',
    ),
    oauthFailed: pickLocalized(
      preferredLanguage,
      'Google ile giriş tamamlanamadı. Lütfen tekrar deneyin.',
      'Google sign-in could not be completed. Please try again.',
    ),
  };

  useEffect(() => {
    if (!routeHydratedRef.current) return;

    const nextPath = resolvePathFromStep(step, currentGallery);
    if ((pathname || '/') === nextPath) return;

    router.push(nextPath);
  }, [currentGallery, pathname, router, step]);

  // ---- Stripe redirect handling --------------------------------------------
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
          // Keep the raw error message when decoding fails.
        }
      }

      const isAccountExists = errStr.toLowerCase().includes('already exists') || errStr.toLowerCase().includes('conflict');
      const detailMsg = isAccountExists
        ? pickLocalized(
          preferredLanguage,
          ' Bu e-posta ile kayıtlı normal bir hesap mevcut. Lütfen şifrenizle giriş yapın.',
          ' Account already exists. Please log in with email and password.',
        )
        : (errStr ? ` (${errStr})` : '');
      addToast(runtimeCopy.oauthFailed + detailMsg, 'error', 7000);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [refreshProfile, runtimeCopy.checkoutCancelled, runtimeCopy.checkoutSuccess, runtimeCopy.oauthFailed, setCheckoutMessage, addToast, preferredLanguage]);

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
    const saved = localStorage.getItem('drawOrDieSettings');
    if (saved) {
      try {
        setFormData(JSON.parse(saved));
      } catch {
        // Ignore malformed local storage contents.
      }
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('drawOrDieSettings', JSON.stringify(formData));
  }, [formData]);

  // ---- File drop handler ---------------------------------------------------
  const { getRootProps, getInputProps, isDragActive } = useDropHandler({
    isPremiumUser,
    preferredLanguage,
  });

  // ---- AI analysis handlers ------------------------------------------------
  const {
    handleAnalyze,
    handleMultiAnalyze,
    handlePremium,
    handleAutoConcept,
    handleMaterialBoard,
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
    preferredLanguage,
    multiJuryPromoActive,
  });

  // ---- Toast color map -----------------------------------------------------
  const toastColors: Record<string, string> = {
    info: 'bg-blue-600/90',
    success: 'bg-emerald-500/90',
    error: 'bg-red-600/90',
    badge: 'bg-yellow-500/90 text-black',
  };

  const shellJustify = TOP_ALIGNED_STEPS.has(step) ? 'justify-start' : 'justify-center';

  return (
    <div className={`min-h-screen w-full flex flex-col items-center ${shellJustify} pt-24 p-4`}>
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      {/* Stripe checkout banner */}
      {checkoutMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-emerald-500/90 text-white font-mono text-sm rounded-lg shadow-lg flex items-center gap-3">
          <span>{checkoutMessage}</span>
          <button
            onClick={() => setCheckoutMessage(null)}
            className="text-white/70 hover:text-white text-lg leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Toast stack */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-5 py-3 rounded-lg shadow-lg font-mono text-sm text-white max-w-sm text-center ${toastColors[toast.type] ?? 'bg-blue-600/90'}`}
          >
            {toast.message}
          </div>
        ))}
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
        preferredLanguage={preferredLanguage}
        multiJuryPromoActive={multiJuryPromoActive}
        handleAnalyze={handleAnalyze}
        handleMultiAnalyze={handleMultiAnalyze}
        handlePremium={handlePremium}
        handleAutoConcept={handleAutoConcept}
        handleMaterialBoard={handleMaterialBoard}
        handleDefenseSubmit={handleDefenseSubmit}
        handleGalleryConsent={handleGalleryConsent}
        handlePreserveAnalysis={handlePreserveAnalysis}
        handleShareToCommunity={handleShareToCommunity}
      />
    </div>
  );
}

