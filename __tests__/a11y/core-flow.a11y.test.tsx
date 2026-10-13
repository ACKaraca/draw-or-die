import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useDropzone } from 'react-dropzone';

import { AuthModal } from '@/components/AuthModal';
import { AnalyzingStep, MultiAnalyzingStep, PremiumAnalyzingStep } from '@/components/AnalyzingSteps';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Header } from '@/components/Header';
import { HeroStep } from '@/components/HeroStep';
import { MultiResultStep } from '@/components/MultiResultStep';
import { PremiumResultStep } from '@/components/PremiumResultStep';
import { PremiumUpgradeStep } from '@/components/PremiumUpgradeStep';
import { ResultStep } from '@/components/ResultStep';
import { UploadStep } from '@/components/UploadStep';
import { expectNoBlockingAxeViolations } from '@/__tests__/a11y/axe-helper';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('framer-motion', () => {
  const passthrough = ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => {
    const domProps = Object.fromEntries(
      Object.entries(props).filter(
        ([key]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout'].includes(key),
      ),
    );
    return <div {...domProps}>{children}</div>;
  };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    MotionConfig: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => false,
    motion: new Proxy({}, { get: () => passthrough }),
  };
});

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('html2canvas', () => jest.fn(() => Promise.reject(new Error('canvas unavailable'))));

jest.mock('@/lib/appwrite', () => ({
  account: {
    createEmailPasswordSession: jest.fn(),
    create: jest.fn(),
    createVerification: jest.fn(),
    createRecovery: jest.fn(),
    createJWT: jest.fn().mockResolvedValue({ jwt: 'mock-jwt' }),
  },
}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

jest.mock('@/lib/growth-tracking', () => ({
  trackConversionEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/logger', () => ({
  reportClientError: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/ReferralCapture', () => ({
  REFERRAL_STORAGE_KEY: 'dod_referral_code_test',
}));

const mockedUseAuth = jest.requireMock('@/hooks/useAuth').useAuth as jest.Mock;

const BASE_FORM_DATA = {
  topic: 'Brutalist Library',
  site: 'Istanbul',
  concept: 'Light wells and circulation',
  defense: 'Main axis and circulation decisions are intentional.',
  category: 'Pafta Tasarımı',
  harshness: 3,
  analysisLength: 'SHORT',
  singlePersonaId: 'constructive',
  multiPersonaIds: ['structural', 'conceptual', 'grumpy'],
};

type UploadOverrides = Partial<React.ComponentProps<typeof UploadStep>>;

// Uses the real react-dropzone wiring so the drop zone's role/tabIndex/input props are audited as shipped.
function RealDropzoneUploadStep({ overrides = {} }: { overrides?: UploadOverrides }) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop: jest.fn() });
  return (
    <UploadStep
      {...uploadProps({ getRootProps, getInputProps, isDragActive, ...overrides })}
    />
  );
}

function uploadProps(overrides: UploadOverrides = {}) {
  return {
    getRootProps: (() => ({})) as never,
    getInputProps: (() => ({})) as never,
    isDragActive: false,
    previewUrl: null,
    mimeType: null,
    formData: BASE_FORM_DATA as never,
    setFormData: jest.fn(),
    handleAnalyze: jest.fn(),
    handleMultiAnalyze: jest.fn(),
    handleAutoConcept: jest.fn(),
    handleMaterialBoard: jest.fn(),
    handleDesignInsight: jest.fn(),
    image: null,
    imageBase64: null,
    additionalUploads: [],
    uploadValidationError: null,
    isRevisionMode: false,
    isAuthenticated: true,
    onAuthRequired: jest.fn(),
    isPremiumUser: false,
    rapidoPens: 12,
    onUpgradeClick: jest.fn(),
    isAnonymous: false,
    guestDrawingCount: 0,
    onGuestUpgradeRequired: jest.fn(),
    ...overrides,
  } as React.ComponentProps<typeof UploadStep>;
}

function resultProps(overrides: Partial<React.ComponentProps<typeof ResultStep>> = {}) {
  return {
    previewUrl: 'https://example.com/drawing.png',
    mimeType: 'image/png',
    handleNewProject: jest.fn(),
    handleRevision: jest.fn(),
    previousProject: null,
    critique: '# Critique',
    lastProgression: 3,
    formData: { harshness: 4 } as never,
    isPremiumUser: false,
    galleryConsent: null,
    galleryPlacement: 'HALL_OF_FAME' as const,
    handleGalleryConsent: jest.fn(),
    handlePremium: jest.fn(),
    isDefending: false,
    setIsDefending: jest.fn(),
    defenseTurnCount: 0,
    defenseMessages: [],
    isDefenseLoading: false,
    defenseInput: '',
    setDefenseInput: jest.fn(),
    handleDefenseSubmit: jest.fn(),
    latestAnalysisKind: 'SINGLE_JURY',
    handleDesignInsight: jest.fn(),
    isAnonymous: false,
    guestDrawingCount: 1,
    showGuestUpgradePrompt: false,
    setShowGuestUpgradePrompt: jest.fn(),
    setGuestDrawingCount: jest.fn(),
    onUpgradeClick: jest.fn(),
    ...overrides,
  } as React.ComponentProps<typeof ResultStep>;
}

describe('core flow accessibility (axe: no critical/serious violations)', () => {
  beforeEach(() => {
    window.localStorage.setItem('dod_studio_tutorial_seen_v1', '1');
    global.fetch = jest.fn();
    mockedUseAuth.mockReturnValue({
      user: { $id: 'u1', email: 'student@example.com', name: 'Student', emailVerified: true },
      profile: { is_premium: false, rapido_pens: 12, progression_score: 10 },
      loading: false,
      signOut: jest.fn(),
      signInAnonymously: jest.fn(),
      signInWithGoogle: jest.fn(),
      reloadSession: jest.fn(),
    });
  });

  it('hero step', async () => {
    render(<HeroStep setStep={jest.fn()} />);
    await expectNoBlockingAxeViolations();
  });

  it('header (signed in) with the profile menu open', async () => {
    render(<Header goHome={jest.fn()} setCurrentGallery={jest.fn()} setStep={jest.fn()} onAuthClick={jest.fn()} />);
    const profileToggle = screen.getByRole('button', { name: /student/i });
    fireEvent.click(profileToggle);
    expect(profileToggle).toHaveAttribute('aria-expanded', 'true');
    await expectNoBlockingAxeViolations();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(profileToggle).toHaveAttribute('aria-expanded', 'false');
    expect(document.activeElement).toBe(profileToggle);
  });

  it('header exposes a skip link that moves focus to the current step heading', () => {
    render(
      <>
        <Header goHome={jest.fn()} setCurrentGallery={jest.fn()} setStep={jest.fn()} onAuthClick={jest.fn()} />
        <div id="step-content" className="contents">
          <h2>Studio Desk</h2>
        </div>
      </>,
    );
    const skipLink = screen.getByRole('link', { name: 'İçeriğe geç' });
    expect(skipLink).toHaveAttribute('href', '#step-content');
    fireEvent.click(skipLink);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Studio Desk' }));
  });

  it('upload step (empty, signed in)', async () => {
    render(<RealDropzoneUploadStep />);
    await expectNoBlockingAxeViolations();
  });

  it('upload step with a validation error announces it', async () => {
    render(<RealDropzoneUploadStep overrides={{ uploadValidationError: 'File exceeds the 35 MB limit.' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('File exceeds the 35 MB limit.');
    await expectNoBlockingAxeViolations();
  });

  it('upload step (guest)', async () => {
    render(<RealDropzoneUploadStep overrides={{ isAuthenticated: false, isAnonymous: true, guestDrawingCount: 1 }} />);
    await expectNoBlockingAxeViolations();
  });

  it('analyzing steps expose a polite status region', async () => {
    render(
      <>
        <AnalyzingStep />
        <PremiumAnalyzingStep />
        <MultiAnalyzingStep />
      </>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(3);
    await expectNoBlockingAxeViolations();
  });

  it('result step', async () => {
    render(<ResultStep {...resultProps()} />);
    await expectNoBlockingAxeViolations();
  });

  it('result step reports a failed export inline instead of toast-only', async () => {
    render(<ResultStep {...resultProps()} />);
    fireEvent.click(screen.getByRole('button', { name: /raporu png olarak indir/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/yeniden|tekrar/i);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /raporu png olarak indir/i })).not.toBeDisabled(),
    );
    await expectNoBlockingAxeViolations();
  });

  it('result step with the before/after comparison', async () => {
    render(
      <ResultStep
        {...resultProps({
          previousProject: { imageBase64: 'aGVsbG8=', mimeType: 'image/png', critique: 'old' } as never,
        })}
      />,
    );
    await expectNoBlockingAxeViolations();
  });

  it('premium result step', async () => {
    render(
      <PremiumResultStep
        {...({
          premiumData: {
            flaws: [
              { reason: 'Circulation is unclear', x: 10, y: 12, width: 18, height: 10 },
              { reason: 'Structural grid is inconsistent' },
            ],
            practicalSolutions: ['Clarify the main axis'],
            reference: 'Mies van der Rohe',
          },
          previewUrl: 'https://example.com/redline.png',
          mimeType: 'image/png',
          selectedFlawIndex: null,
          setSelectedFlawIndex: jest.fn(),
          handleNewProject: jest.fn(),
          isPremiumUser: true,
          isDefending: false,
          setIsDefending: jest.fn(),
          defenseTurnCount: 0,
          defenseMessages: [],
          isDefenseLoading: false,
          defenseInput: '',
          setDefenseInput: jest.fn(),
          handleDefenseSubmit: jest.fn(),
          handlePreserveAnalysis: jest.fn(),
          previousProject: null,
        } as unknown as React.ComponentProps<typeof PremiumResultStep>)}
      />,
    );
    await expectNoBlockingAxeViolations();
  });

  it('multi result step', async () => {
    render(
      <MultiResultStep
        multiData={{
          personas: [
            { id: 'structural', name: 'Strukturcu', critique: 'Test critique', score: 60 },
            { id: 'conceptual', name: 'Konseptuel', critique: 'Test critique', score: 55 },
          ],
          projectTitle: 'Test Project',
        } as never}
        previewUrl="https://example.com/drawing.png"
        mimeType="image/png"
        handleNewProject={jest.fn()}
        handlePreserveAnalysis={jest.fn()}
      />,
    );
    await expectNoBlockingAxeViolations();
  });

  it('premium upgrade + rapido shop entry', async () => {
    const { unmount } = render(<PremiumUpgradeStep setStep={jest.fn()} />);
    await expectNoBlockingAxeViolations();
    unmount();
    render(<PremiumUpgradeStep setStep={jest.fn()} initialTab="rapido" />);
    await expectNoBlockingAxeViolations();
  });

  it('auth modal', async () => {
    render(<AuthModal isOpen onClose={jest.fn()} />);
    await expectNoBlockingAxeViolations();
  });
});

describe('dialog keyboard contract', () => {
  function DialogHarness({ isOpen, onCancel }: { isOpen: boolean; onCancel: () => void }) {
    return (
      <>
        <main data-testid="page">
          <button type="button">Trigger</button>
        </main>
        <ConfirmDialog
          isOpen={isOpen}
          title="Delete project?"
          description="This cannot be undone."
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isDestructive
          onConfirm={jest.fn()}
          onCancel={onCancel}
        />
      </>
    );
  }

  it('traps Tab, makes the background inert, closes on Escape and restores focus', async () => {
    const onCancel = jest.fn();
    const { rerender } = render(<DialogHarness isOpen={false} onCancel={onCancel} />);
    const trigger = screen.getByRole('button', { name: 'Trigger' });
    trigger.focus();

    rerender(<DialogHarness isOpen onCancel={onCancel} />);

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(document.activeElement).toBe(cancel);
    expect(screen.getByTestId('page').closest('[inert]')).not.toBeNull();

    confirm.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    await expectNoBlockingAxeViolations();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);

    act(() => {
      rerender(<DialogHarness isOpen={false} onCancel={onCancel} />);
    });
    expect(screen.getByTestId('page').closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('auth modal traps focus and makes the page inert', () => {
    render(
      <>
        <main data-testid="page">
          <button type="button">Open</button>
        </main>
        <AuthModal isOpen onClose={jest.fn()} />
      </>,
    );
    expect(screen.getByTestId('page').closest('[inert]')).not.toBeNull();
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
