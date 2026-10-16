'use client';

/**
 * StepRouter.tsx
 *
 * Maps the current StepType to the appropriate component.
 * Reads state from drawOrDieStore and receives handlers as props.
 * Keeps page.tsx as a thin orchestrator.
 */

import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

import { HeroStep } from '@/components/HeroStep';
import { StepLoadingFallback } from '@/components/StepLoadingFallback';
import { UploadStep } from '@/components/UploadStep';
import { STEP_CONTENT_ID, findStepHeading, focusStepHeading, listStepHeadings } from '@/components/ui/step-focus';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';

import type { DropzoneState } from 'react-dropzone';
import type { CommunityShareOptions } from '@/components/CommunityShareButton';
import type { DesignInsightOperation } from '@/lib/design-insights';
import type { SupportedLanguage } from '@/lib/i18n';
import type { Badge } from '@/types';

// Every step except the landing + Studio Desk is split out of the first-load bundle
// (html2canvas, react-markdown, mentor/archbuilder code only load when that step opens).
const stepLoading = () => <StepLoadingFallback />;

const AnalyzingStep = dynamic(
  () => import('@/components/AnalyzingSteps').then((mod) => mod.AnalyzingStep),
  { loading: stepLoading },
);
const PremiumAnalyzingStep = dynamic(
  () => import('@/components/AnalyzingSteps').then((mod) => mod.PremiumAnalyzingStep),
  { loading: stepLoading },
);
const MultiAnalyzingStep = dynamic(
  () => import('@/components/AnalyzingSteps').then((mod) => mod.MultiAnalyzingStep),
  { loading: stepLoading },
);
const ResultStep = dynamic(() => import('@/components/ResultStep').then((mod) => mod.ResultStep), {
  loading: stepLoading,
});
const PremiumResultStep = dynamic(
  () => import('@/components/PremiumResultStep').then((mod) => mod.PremiumResultStep),
  { loading: stepLoading },
);
const GalleryStep = dynamic(() => import('@/components/GalleryStep').then((mod) => mod.GalleryStep), {
  loading: stepLoading,
});
const MultiResultStep = dynamic(
  () => import('@/components/MultiResultStep').then((mod) => mod.MultiResultStep),
  { loading: stepLoading },
);
const AIMentorStep = dynamic(() => import('@/components/AIMentorStep').then((mod) => mod.AIMentorStep), {
  loading: stepLoading,
});
const HistoryStep = dynamic(() => import('@/components/HistoryStep').then((mod) => mod.HistoryStep), {
  loading: stepLoading,
});
const PremiumUpgradeStep = dynamic(
  () => import('@/components/PremiumUpgradeStep').then((mod) => mod.PremiumUpgradeStep),
  { loading: stepLoading },
);
const ProfileStep = dynamic(() => import('@/components/ProfileStep').then((mod) => mod.ProfileStep), {
  loading: stepLoading,
});
const AccountDetailsStep = dynamic(
  () => import('@/components/AccountDetailsStep').then((mod) => mod.AccountDetailsStep),
  { loading: stepLoading },
);
const ArchBuilderStep = dynamic(
  () => import('@/components/ArchBuilderStep').then((mod) => mod.ArchBuilderStep),
  { loading: stepLoading },
);

interface StepRouterProps {
  // Dropzone bindings (computed in page.tsx via useDropHandler)
  getRootProps: DropzoneState['getRootProps'];
  getInputProps: DropzoneState['getInputProps'];
  isDragActive: boolean;

  // Auth-derived values (passed from page.tsx to avoid coupling store to auth)
  isAuthenticated: boolean;
  userId: string | null;
  onAuthRequired: () => void;
  isPremiumUser: boolean;
  isAnonymous: boolean; // P0.3: Guest mode identifier
  rapidoPens: number;
  progressionScore: number;
  earnedBadges: Badge[];
  preferredLanguage?: SupportedLanguage;
  multiJuryPromoActive?: boolean;

  // AI handlers (from useAnalysis hook). Promise-returning handlers let result screens show
  // loading/done states; plain void handlers stay valid for callers that do not track them.
  handleAnalyze: () => void;
  handleMultiAnalyze: () => void;
  handlePremium: () => Promise<void> | void;
  handleAutoConcept: () => void;
  handleMaterialBoard: () => void;
  handleDesignInsight: (operation: DesignInsightOperation) => void;
  handleDefenseSubmit: () => void;
  handleGalleryConsent: (val: boolean) => Promise<boolean> | void;
  handlePreserveAnalysis?: () => Promise<boolean> | void;
  handleShareToCommunity?: (options: CommunityShareOptions) => Promise<boolean> | void;
}

export function StepRouter({
  getRootProps,
  getInputProps,
  isDragActive,
  isAuthenticated,
  userId,
  onAuthRequired,
  isPremiumUser,
  isAnonymous,
  rapidoPens,
  progressionScore,
  earnedBadges,
  preferredLanguage = 'tr',
  multiJuryPromoActive = false,
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
}: StepRouterProps) {
  const {
    step,
    setStep,
    // image domain
    image,
    imageBase64,
    additionalUploads,
    previewUrl,
    mimeType,
    pdfText,
    uploadValidationError,
    // form domain
    formData,
    setFormData,
    // result domain
    critique,
    premiumData,
    multiData,
    latestAnalysisKind,
    previousProject,
    lastProgression,
    isRevisionMode,
    selectedFlawIndex,
    setSelectedFlawIndex,
    // defense domain
    isDefending,
    setIsDefending,
    defenseMessages,
    defenseTurnCount,
    defenseInput,
    setDefenseInput,
    isDefenseLoading,
    // gallery domain
    galleryItems,
    galleryPlacement,
    galleryConsent,
    currentGallery,
    setCurrentGallery,
    // ui domain - P0.3: guest mode
    guestDrawingCount,
    showGuestUpgradePrompt,
    setGuestDrawingCount,
    setShowGuestUpgradePrompt,
    // compound actions
    startNewProject,
    startRevision,
  } = useDrawOrDieStore();

  const contentRef = useRef<HTMLDivElement>(null);
  const stopObservingRef = useRef<(() => void) | null>(null);

  useEffect(() => () => stopObservingRef.current?.(), []);

  // A step change unmounts the focused control, which would drop keyboard/screen-reader users back to <body>.
  // Exits only happen on step changes. AnimatePresence ("wait") calls this just before it swaps in the incoming
  // step, so headings present right now belong to the outgoing step and are skipped.
  const focusIncomingStepHeading = useCallback(() => {
    const container = contentRef.current;
    if (!container) return;
    stopObservingRef.current?.();
    const outgoingHeadings = new Set<Element>(listStepHeadings(container));

    const tryFocus = (): boolean => {
      // A dialog that opened with the step (e.g. the guest prompt) owns focus; do not steal it.
      if (document.activeElement?.closest('[role="dialog"]')) return true;
      const heading = findStepHeading(container, outgoingHeadings);
      if (!heading) return false;
      focusStepHeading(heading);
      return true;
    };
    if (tryFocus() || typeof MutationObserver === 'undefined') return;

    // Lazily loaded steps render their heading after the chunk arrives.
    const observer = new MutationObserver(() => {
      if (tryFocus()) stop();
    });
    const timeout = window.setTimeout(() => stop(), 5000);
    function stop() {
      observer.disconnect();
      window.clearTimeout(timeout);
      stopObservingRef.current = null;
    }
    stopObservingRef.current = stop;
    observer.observe(container, { childList: true, subtree: true });
  }, []);

  return (
    <div id={STEP_CONTENT_ID} ref={contentRef} className="contents">
      <AnimatePresence mode="wait" onExitComplete={focusIncomingStepHeading}>
        {step === 'hero' && <HeroStep key="hero" setStep={setStep} />}

        {step === 'upload' && (
          <UploadStep
            key="upload"
            getRootProps={getRootProps}
            getInputProps={getInputProps}
            isDragActive={isDragActive}
            previewUrl={previewUrl}
            mimeType={mimeType}
            formData={formData}
            setFormData={setFormData}
            handleAnalyze={handleAnalyze}
            handleMultiAnalyze={handleMultiAnalyze}
            handleAutoConcept={handleAutoConcept}
            handleMaterialBoard={handleMaterialBoard}
            handleDesignInsight={handleDesignInsight}
            image={image}
            imageBase64={imageBase64}
            additionalUploads={additionalUploads}
            pdfText={pdfText}
            uploadValidationError={uploadValidationError}
            isRevisionMode={isRevisionMode}
            isAuthenticated={isAuthenticated}
            onAuthRequired={onAuthRequired}
            isPremiumUser={isPremiumUser}
            rapidoPens={rapidoPens}
            onUpgradeClick={() => setStep('premium-upgrade')}
            isAnonymous={isAnonymous}
            guestDrawingCount={guestDrawingCount}
            onGuestUpgradeRequired={onAuthRequired}
            preferredLanguage={preferredLanguage}
            multiJuryPromoActive={multiJuryPromoActive}
          />
        )}

        {step === 'archbuilder' && (
          <ArchBuilderStep
            key="archbuilder"
            onAuthRequired={onAuthRequired}
          />
        )}

        {step === 'analyzing' && <AnalyzingStep key="analyzing" />}
        {step === 'multi-analyzing' && <MultiAnalyzingStep key="multi-analyzing" />}
        {step === 'premium-analyzing' && <PremiumAnalyzingStep key="premium-analyzing" />}

        {step === 'result' && (
          <ResultStep
            key="result"
            previewUrl={previewUrl}
            mimeType={mimeType}
            handleNewProject={startNewProject}
            handleRevision={startRevision}
            previousProject={previousProject}
            critique={critique}
            lastProgression={lastProgression}
            formData={formData}
            isPremiumUser={isPremiumUser}
            galleryConsent={galleryConsent}
            galleryPlacement={galleryPlacement}
            handleGalleryConsent={handleGalleryConsent}
            handlePremium={handlePremium}
            isDefending={isDefending}
            setIsDefending={setIsDefending}
            defenseTurnCount={defenseTurnCount}
            defenseMessages={defenseMessages}
            isDefenseLoading={isDefenseLoading}
            defenseInput={defenseInput}
            setDefenseInput={setDefenseInput}
            handleDefenseSubmit={handleDefenseSubmit}
            isAnonymous={isAnonymous}
            guestDrawingCount={guestDrawingCount}
            showGuestUpgradePrompt={showGuestUpgradePrompt}
            setShowGuestUpgradePrompt={setShowGuestUpgradePrompt}
            setGuestDrawingCount={setGuestDrawingCount}
            onUpgradeClick={() => setStep('premium-upgrade')}
            onAuthRequired={onAuthRequired}
            handlePreserveAnalysis={handlePreserveAnalysis}
            handleShareToCommunity={handleShareToCommunity}
            handleAutoConcept={handleAutoConcept}
            handleDesignInsight={handleDesignInsight}
            latestAnalysisKind={latestAnalysisKind}
          />
        )}

        {step === 'premium' && premiumData && (
          <PremiumResultStep
            key="premium"
            premiumData={premiumData}
            previewUrl={previewUrl}
            mimeType={mimeType}
            selectedFlawIndex={selectedFlawIndex}
            setSelectedFlawIndex={setSelectedFlawIndex}
            handleNewProject={startNewProject}
            isPremiumUser={isPremiumUser}
            isDefending={isDefending}
            setIsDefending={setIsDefending}
            defenseTurnCount={defenseTurnCount}
            defenseMessages={defenseMessages}
            isDefenseLoading={isDefenseLoading}
            defenseInput={defenseInput}
            setDefenseInput={setDefenseInput}
            handleDefenseSubmit={handleDefenseSubmit}
            previousProject={previousProject}
            handlePreserveAnalysis={handlePreserveAnalysis}
            handleShareToCommunity={handleShareToCommunity}
          />
        )}

        {step === 'multi-result' && multiData && (
          <MultiResultStep
            key="multi-result"
            multiData={multiData}
            previewUrl={previewUrl}
            mimeType={mimeType}
            handleNewProject={startNewProject}
            handlePremium={handlePremium}
            handlePreserveAnalysis={handlePreserveAnalysis}
            handleShareToCommunity={handleShareToCommunity}
          />
        )}

        {step === 'gallery' && (
          <GalleryStep
            key="gallery"
            currentGallery={currentGallery}
            setCurrentGallery={setCurrentGallery}
            galleryItems={galleryItems}
          />
        )}

        {step === 'ai-mentor' && (
          <AIMentorStep
            key="ai-mentor"
            isAuthenticated={isAuthenticated}
            userId={userId}
            isAnonymous={isAnonymous}
            isPremiumUser={isPremiumUser}
            progressionScore={progressionScore}
            earnedBadges={earnedBadges}
            onNavigateStudioDesk={() => setStep('upload')}
            onUpgradeClick={() => setStep('premium-upgrade')}
            preferredLanguage={preferredLanguage}
          />
        )}

        {step === 'history' && <HistoryStep key="history" />}

        {step === 'profile' && (
          <ProfileStep
            key="profile"
            onUpgradeClick={() => setStep('premium-upgrade')}
            onOpenRapidoShop={() => setStep('rapido-shop')}
            onOpenAccountDetails={() => setStep('account-details')}
            onOpenHistory={() => setStep('history')}
            onAuthRequired={onAuthRequired}
          />
        )}

        {step === 'premium-upgrade' && <PremiumUpgradeStep key="premium-upgrade" setStep={setStep} />}

        {step === 'rapido-shop' && <PremiumUpgradeStep key="rapido-shop" setStep={setStep} initialTab="rapido" />}

        {step === 'account-details' && (
          <AccountDetailsStep
            key="account-details"
            onBack={() => setStep('profile')}
            onOpenRapidoShop={() => setStep('rapido-shop')}
            onOpenPremiumShop={() => setStep('premium-upgrade')}
            onAuthRequired={onAuthRequired}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
