'use client';

/**
 * StepRouter.tsx
 *
 * Maps the current StepType to the appropriate component.
 * Reads state from drawOrDieStore and receives handlers as props.
 * Keeps page.tsx as a thin orchestrator.
 */

import { AnimatePresence } from 'framer-motion';
import { HeroStep } from '@/components/HeroStep';
import { UploadStep } from '@/components/UploadStep';
import {
  AnalyzingStep,
  PremiumAnalyzingStep,
  MultiAnalyzingStep,
} from '@/components/AnalyzingSteps';
import { ResultStep } from '@/components/ResultStep';
import { PremiumResultStep } from '@/components/PremiumResultStep';
import { GalleryStep } from '@/components/GalleryStep';
import { MultiResultStep } from '@/components/MultiResultStep';
import { AIMentorStep } from '@/components/AIMentorStep';
import { HistoryStep } from '@/components/HistoryStep';
import { PremiumUpgradeStep } from '@/components/PremiumUpgradeStep';
import { ProfileStep } from '@/components/ProfileStep';
import { AccountDetailsStep } from '@/components/AccountDetailsStep';
import { ArchBuilderStep } from '@/components/ArchBuilderStep';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import type { SupportedLanguage } from '@/lib/i18n';

interface StepRouterProps {
  // Dropzone bindings (computed in page.tsx via useDropHandler)
  getRootProps: ReturnType<typeof import('react-dropzone').useDropzone>['getRootProps'];
  getInputProps: ReturnType<typeof import('react-dropzone').useDropzone>['getInputProps'];
  isDragActive: boolean;

  // Auth-derived values (passed from page.tsx to avoid coupling store to auth)
  isAuthenticated: boolean;
  userId: string | null;
  onAuthRequired: () => void;
  isPremiumUser: boolean;
  isAnonymous: boolean; // P0.3: Guest mode identifier
  rapidoPens: number;
  progressionScore: number;
  earnedBadges: import('@/types').Badge[];
  preferredLanguage?: SupportedLanguage;
  multiJuryPromoActive?: boolean;

  // AI handlers (from useAnalysis hook)
  handleAnalyze: () => void;
  handleMultiAnalyze: () => void;
  handlePremium: () => void;
  handleAutoConcept: () => void;
  handleMaterialBoard: () => void;
  handleDefenseSubmit: () => void;
  handleGalleryConsent: (val: boolean) => void;
  handlePreserveAnalysis?: () => void;
  handleShareToCommunity?: () => void;
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

  return (
    <AnimatePresence mode="wait">
      {step === 'hero' && <HeroStep setStep={setStep} />}

      {step === 'upload' && (
        <UploadStep
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
          onGuestUpgradeRequired={() => {
            setShowGuestUpgradePrompt(true);
            setStep('premium-upgrade');
          }}
          preferredLanguage={preferredLanguage}
          multiJuryPromoActive={multiJuryPromoActive}
        />
      )}

      {step === 'archbuilder' && (
        <ArchBuilderStep
          onAuthRequired={onAuthRequired}
        />
      )}

      {step === 'analyzing' && <AnalyzingStep />}
      {step === 'multi-analyzing' && <MultiAnalyzingStep />}
      {step === 'premium-analyzing' && <PremiumAnalyzingStep />}

      {step === 'result' && (
        <ResultStep
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
          handlePreserveAnalysis={handlePreserveAnalysis}
          handleShareToCommunity={handleShareToCommunity}
          handleAutoConcept={handleAutoConcept}
        />
      )}

      {step === 'premium' && premiumData && (
        <PremiumResultStep
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
          currentGallery={currentGallery}
          setCurrentGallery={setCurrentGallery}
          galleryItems={galleryItems}
        />
      )}

      {step === 'ai-mentor' && (
        <AIMentorStep
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

      {step === 'history' && <HistoryStep />}

      {step === 'profile' && (
        <ProfileStep
          onUpgradeClick={() => setStep('premium-upgrade')}
          onOpenRapidoShop={() => setStep('rapido-shop')}
          onOpenAccountDetails={() => setStep('account-details')}
          onOpenHistory={() => setStep('history')}
          onAuthRequired={onAuthRequired}
        />
      )}

      {step === 'premium-upgrade' && <PremiumUpgradeStep setStep={setStep} />}

      {step === 'rapido-shop' && <PremiumUpgradeStep setStep={setStep} initialTab="rapido" />}

      {step === 'account-details' && (
        <AccountDetailsStep
          onBack={() => setStep('profile')}
          onOpenRapidoShop={() => setStep('rapido-shop')}
          onOpenPremiumShop={() => setStep('premium-upgrade')}
          onAuthRequired={onAuthRequired}
        />
      )}
    </AnimatePresence>
  );
}
