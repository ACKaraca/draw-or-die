import { render, waitFor } from '@testing-library/react';
import { StepRouter } from '@/components/StepRouter';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';

jest.mock('@/stores/drawOrDieStore', () => ({
  useDrawOrDieStore: jest.fn(),
}));

jest.mock('@/components/HeroStep', () => ({
  HeroStep: ({ setStep }: { setStep: (s: string) => void }) => (
    <button data-testid="hero-step" type="button" onClick={() => setStep('upload')}>
      Hero
    </button>
  ),
}));

jest.mock('@/components/UploadStep', () => ({
  UploadStep: () => <div data-testid="upload-step">Upload</div>,
}));
jest.mock('@/components/AnalyzingSteps', () => ({
  AnalyzingStep: () => <div data-testid="analyzing-step">Analyzing</div>,
  PremiumAnalyzingStep: () => <div data-testid="premium-analyzing-step">Premium</div>,
  MultiAnalyzingStep: () => <div data-testid="multi-analyzing-step">Multi</div>,
}));
jest.mock('@/components/ResultStep', () => ({
  ResultStep: () => <div data-testid="result-step">Result</div>,
}));
jest.mock('@/components/PremiumResultStep', () => ({
  PremiumResultStep: () => <div data-testid="premium-result-step">Premium Result</div>,
}));
jest.mock('@/components/GalleryStep', () => ({
  GalleryStep: () => <div data-testid="gallery-step">Gallery</div>,
}));
jest.mock('@/components/MultiResultStep', () => ({
  MultiResultStep: () => <div data-testid="multi-result-step">Multi Result</div>,
}));
jest.mock('@/components/AIMentorStep', () => ({
  AIMentorStep: () => <div data-testid="mentor-step">Mentor</div>,
}));
jest.mock('@/components/PremiumUpgradeStep', () => ({
  PremiumUpgradeStep: () => <div data-testid="upgrade-step">Upgrade</div>,
}));
jest.mock('@/components/ProfileStep', () => ({
  ProfileStep: () => <div data-testid="profile-step">Profile</div>,
}));
jest.mock('@/components/AccountDetailsStep', () => ({
  AccountDetailsStep: () => <div data-testid="account-details-step">Account Details</div>,
}));

const mockedStore = jest.mocked(useDrawOrDieStore);

describe('StepRouter', () => {
  const setStep = jest.fn();
  const setFormData = jest.fn();
  const setSelectedFlawIndex = jest.fn();
  const setIsDefending = jest.fn();
  const setDefenseInput = jest.fn();
  const handle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedStore.mockReturnValue({
      step: 'hero',
      setStep,
      image: null,
      previewUrl: null,
      mimeType: null,
      formData: { topic: '', category: 'Vaziyet Planı', harshness: 2, site: '', concept: '', defense: '', analysisLength: 'SHORT' },
      setFormData,
      critique: '',
      premiumData: null,
      multiData: null,
      previousProject: null,
      lastProgression: null,
      isRevisionMode: false,
      selectedFlawIndex: null,
      setSelectedFlawIndex,
      isDefending: false,
      setIsDefending,
      defenseMessages: [],
      defenseTurnCount: 0,
      defenseInput: '',
      setDefenseInput,
      isDefenseLoading: false,
      galleryItems: [],
      galleryPlacement: 'NONE',
      galleryConsent: null,
      currentGallery: null,
      setCurrentGallery: jest.fn(),
      guestDrawingCount: 0,
      showGuestUpgradePrompt: false,
      setGuestDrawingCount: jest.fn(),
      setShowGuestUpgradePrompt: jest.fn(),
      goHome: jest.fn(),
      startNewProject: jest.fn(),
      startRevision: jest.fn(),
    } as never);
  });

  it('renders the hero route and opens Studio Desk (upload) from the hero shell', () => {
    const { getByTestId } = render(
      <StepRouter
        getRootProps={jest.fn() as never}
        getInputProps={jest.fn() as never}
        isDragActive={false}
        isAuthenticated={false}
        userId={null}
        onAuthRequired={handle}
        isPremiumUser={false}
        isAnonymous={false}
        rapidoPens={0}
        progressionScore={0}
        earnedBadges={[]}
        handleAnalyze={handle}
        handleMultiAnalyze={handle}
        handlePremium={handle}
        handleAutoConcept={handle}
        handleMaterialBoard={handle}
        handleDefenseSubmit={handle}
        handleGalleryConsent={handle}
      />
    );

    getByTestId('hero-step').click();
    expect(setStep).toHaveBeenCalledWith('upload');
  });

  it('renders gallery step when gallery route is active', async () => {
    mockedStore.mockReturnValueOnce({
      step: 'gallery',
      setStep,
      image: null,
      previewUrl: null,
      mimeType: null,
      formData: { topic: '', category: 'Vaziyet Planı', harshness: 2, site: '', concept: '', defense: '', analysisLength: 'SHORT' },
      setFormData,
      critique: '',
      premiumData: null,
      multiData: null,
      previousProject: null,
      lastProgression: null,
      isRevisionMode: false,
      selectedFlawIndex: null,
      setSelectedFlawIndex,
      isDefending: false,
      setIsDefending,
      defenseMessages: [],
      defenseTurnCount: 0,
      defenseInput: '',
      setDefenseInput,
      isDefenseLoading: false,
      galleryItems: [],
      galleryPlacement: 'NONE',
      galleryConsent: null,
      currentGallery: null,
      setCurrentGallery: jest.fn(),
      guestDrawingCount: 0,
      showGuestUpgradePrompt: false,
      setGuestDrawingCount: jest.fn(),
      setShowGuestUpgradePrompt: jest.fn(),
      goHome: jest.fn(),
      startNewProject: jest.fn(),
      startRevision: jest.fn(),
    } as never);

    const { getByTestId } = render(
      <StepRouter
        getRootProps={jest.fn() as never}
        getInputProps={jest.fn() as never}
        isDragActive={false}
        isAuthenticated={false}
        userId={null}
        onAuthRequired={handle}
        isPremiumUser={false}
        isAnonymous={false}
        rapidoPens={0}
        progressionScore={0}
        earnedBadges={[]}
        handleAnalyze={handle}
        handleMultiAnalyze={handle}
        handlePremium={handle}
        handleAutoConcept={handle}
        handleMaterialBoard={handle}
        handleDefenseSubmit={handle}
        handleGalleryConsent={handle}
      />
    );

    await waitFor(() => expect(getByTestId('gallery-step')).toBeTruthy());
  });
});
