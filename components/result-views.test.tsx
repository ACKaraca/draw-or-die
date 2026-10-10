import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ResultStep } from '@/components/ResultStep';
import { PremiumResultStep } from '@/components/PremiumResultStep';
import { MultiResultStep } from '@/components/MultiResultStep';
import html2canvas from 'html2canvas';

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) => <div {...props}>{children}</div>,
  },
}));

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ChatDefense', () => ({
  ChatDefense: () => <div data-testid="chat-defense" />,
}));

jest.mock('html2canvas', () => jest.fn());

const mockedHtml2canvas = jest.mocked(html2canvas);

function baseResultProps(overrides: Partial<React.ComponentProps<typeof ResultStep>> = {}) {
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
    galleryPlacement: 'NONE' as const,
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
    isAnonymous: true,
    guestDrawingCount: 0,
    showGuestUpgradePrompt: false,
    setShowGuestUpgradePrompt: jest.fn(),
    setGuestDrawingCount: jest.fn(),
    onUpgradeClick: jest.fn(),
    ...overrides,
  };
}

function basePremiumProps(overrides: Partial<React.ComponentProps<typeof PremiumResultStep>> = {}) {
  return {
    premiumData: {
      flaws: [
        { reason: 'Circulation is unclear', x: 10, y: 12, width: 18, height: 10 },
        { reason: 'Structural grid is inconsistent' },
      ],
      practicalSolutions: ['Clarify the main axis', 'Align the grid to the program'],
      reference: 'Mies van der Rohe',
    } as never,
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
    ...overrides,
  };
}

function baseMultiProps(overrides: Partial<React.ComponentProps<typeof MultiResultStep>> = {}) {
  return {
    multiData: {
      personas: [
        { id: 'structural', name: 'Strukturcu', critique: 'Test critique', score: 60 },
        { id: 'conceptual', name: 'Konseptuel', critique: 'Test critique', score: 55 },
      ],
      projectTitle: 'Test Project',
    },
    previewUrl: 'https://example.com/drawing.png',
    mimeType: 'image/png',
    handleNewProject: jest.fn(),
    handlePreserveAnalysis: jest.fn(),
    ...overrides,
  };
}

describe('result views', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the guest upgrade prompt and responds to CTA actions', async () => {
    const props = baseResultProps();

    render(<ResultStep {...props} />);

    expect(props.setGuestDrawingCount).toHaveBeenCalledWith(1);
    expect(props.setShowGuestUpgradePrompt).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Great Work!')).toBeNull();
    expect(props.onUpgradeClick).not.toHaveBeenCalled();
  });

  it('routes the guest "Create account" CTA to the auth modal, not the Premium shop', () => {
    const onAuthRequired = jest.fn();
    const props = baseResultProps({ showGuestUpgradePrompt: true, onAuthRequired });

    render(<ResultStep {...props} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(screen.getByRole('button', { name: /hesap oluştur/i }));

    expect(onAuthRequired).toHaveBeenCalledTimes(1);
    expect(props.onUpgradeClick).not.toHaveBeenCalled();
    expect(props.setShowGuestUpgradePrompt).toHaveBeenCalledWith(false);
  });

  it('closes the guest prompt with Escape', () => {
    const props = baseResultProps({ showGuestUpgradePrompt: true });

    render(<ResultStep {...props} />);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(props.setShowGuestUpgradePrompt).toHaveBeenCalledWith(false);
  });

  it('renders gallery consent actions and opens the revision comparison toggle', async () => {
    const handleGalleryConsent = jest.fn().mockResolvedValue(true);

    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          galleryConsent: null,
          isPremiumUser: true,
          galleryPlacement: 'HALL_OF_FAME',
          handleGalleryConsent,
          latestAnalysisKind: 'REVISION_SAME',
          previousProject: {
            mimeType: 'image/png',
            imageBase64: 'abc',
            critique: 'Earlier critique',
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText('İzin Ver'));
    await waitFor(() => expect(screen.getByRole('button', { name: /gizli tut/i })).not.toBeDisabled());
    fireEvent.click(screen.getByText('Gizli Tut'));
    expect(handleGalleryConsent).toHaveBeenNthCalledWith(1, true);
    await waitFor(() => expect(handleGalleryConsent).toHaveBeenNthCalledWith(2, false));

    fireEvent.click(screen.getByRole('button', { name: /evrim görünümü/i }));
    expect(screen.getByAltText('Önce')).toHaveAttribute('src', 'data:image/png;base64,abc');
    expect(screen.getByAltText('Sonra')).toBeTruthy();
  });

  it('shows the gallery consent card to free users too (explicit opt-in for every tier)', () => {
    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          isPremiumUser: false,
          galleryPlacement: 'WALL_OF_DEATH',
        })}
      />,
    );

    expect(screen.getByRole('button', { name: 'İzin Ver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gizli tut/i })).toBeInTheDocument();
  });

  it('hides the evolution toggle after a fresh jury run (before and after would be the same board)', () => {
    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          latestAnalysisKind: 'SINGLE_JURY',
          previousProject: { mimeType: 'image/png', imageBase64: 'abc', critique: 'Same board' },
        })}
      />,
    );

    expect(screen.queryByRole('button', { name: /evrim görünümü/i })).toBeNull();
  });

  it('calls preserve handler from result step action and shows the done state', async () => {
    const handlePreserveAnalysis = jest.fn().mockResolvedValue(true);

    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          handlePreserveAnalysis,
        })}
      />,
    );

    const preserveButton = screen.getByRole('button', { name: /analizi koru/i });
    expect(preserveButton).toHaveTextContent('Analizi Koru (1.5 Rapido)');
    fireEvent.click(preserveButton);
    fireEvent.click(preserveButton);

    expect(handlePreserveAnalysis).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: /analiz korundu/i })).toBeDisabled();
  });

  it('asks for confirmation before starting a new project', () => {
    const handleNewProject = jest.fn();

    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          handleNewProject,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /yeni proje/i }));
    expect(handleNewProject).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /yeni proje başlat/i }));
    expect(handleNewProject).toHaveBeenCalledTimes(1);
  });

  it('requires in-app consent before sharing to the community', async () => {
    const handleShareToCommunity = jest.fn().mockResolvedValue(true);

    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          handleShareToCommunity,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /toplulukta paylaş/i }));
    expect(handleShareToCommunity).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /onaylıyorum, paylaş/i }));

    expect(handleShareToCommunity).toHaveBeenCalledWith({ confirmed: true });
    expect(await screen.findByRole('button', { name: /toplulukta paylaşıldı/i })).toBeDisabled();
  });

  it('keeps the original critique and renders appended outputs in their own section', () => {
    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          critique: 'Original jury critique\n\n---\n\n## ◈ Kişisel Beceri Rotası\n\nWeek 1: section drills',
        })}
      />,
    );

    expect(screen.getByText(/Original jury critique/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Kişisel Beceri Rotası' })).toHaveTextContent('Week 1: section drills');
    expect(screen.queryByRole('button', { name: /beceri rotamı oluştur/i })).toBeNull();
  });

  it('shows a loading state from the first Premium Rescue click', async () => {
    let resolveRescue: () => void = () => {};
    const handlePremium = jest.fn(() => new Promise<void>((resolve) => { resolveRescue = resolve; }));

    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          handlePremium,
        })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /kilidi aç/i }));
    const busyButton = screen.getByRole('button', { name: /paftalar hazırlanıyor/i });
    expect(busyButton).toBeDisabled();
    fireEvent.click(busyButton);
    expect(handlePremium).toHaveBeenCalledTimes(1);

    resolveRescue();
    expect(await screen.findByRole('button', { name: /kilidi aç/i })).not.toBeDisabled();
  });

  it('renders a focused diagnostic report and can build a skill roadmap', () => {
    const handleDesignInsight = jest.fn();

    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          latestAnalysisKind: 'ACCESSIBILITY_EGRESS',
          handleDesignInsight,
        })}
      />,
    );

    expect(screen.getByText('Erişilebilirlik ve Kaçış Ön Kontrolü')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-defense')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /beceri rotamı oluştur/i }));
    expect(handleDesignInsight).toHaveBeenCalledWith('SKILL_ROADMAP');
  });

  it('calls preserve handler from multi result step action', () => {
    const handlePreserveAnalysis = jest.fn();

    render(<MultiResultStep {...baseMultiProps({ handlePreserveAnalysis })} />);

    fireEvent.click(screen.getByRole('button', { name: /analizi koru/i }));
    expect(handlePreserveAnalysis).toHaveBeenCalledTimes(1);
  });

  it('renders interactive image previews in result variants for image sources', () => {
    const first = render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
        })}
      />,
    );
    expect(screen.getByTestId('interactive-image-preview')).toBeInTheDocument();
    first.unmount();

    const second = render(<MultiResultStep {...baseMultiProps()} />);
    expect(screen.getByTestId('interactive-image-preview')).toBeInTheDocument();
    second.unmount();

    const third = render(<PremiumResultStep {...basePremiumProps()} />);
    expect(screen.getByTestId('interactive-image-preview')).toBeInTheDocument();
    third.unmount();
  });

  it('exports the premium result and toggles flaw details', async () => {
    const clickSpy = jest.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});
    const premiumProps = basePremiumProps();
    mockedHtml2canvas.mockResolvedValue({
      toDataURL: () => 'data:image/png;base64,exported',
    } as never);

    render(<PremiumResultStep {...premiumProps} />);

    fireEvent.click(screen.getByTitle(/roast|download/i));

    await waitFor(() => expect(mockedHtml2canvas).toHaveBeenCalled());
    expect(clickSpy).toHaveBeenCalled();

    fireEvent.click(screen.getAllByText('Circulation is unclear')[0]);
    expect(premiumProps.setSelectedFlawIndex).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole('button', { name: /analizi koru/i }));
    expect(premiumProps.handlePreserveAnalysis).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });

  it('renders premium flaw markers as labelled, keyboard-reachable buttons', () => {
    const premiumProps = basePremiumProps();

    render(<PremiumResultStep {...premiumProps} />);

    const marker = screen.getByRole('button', { name: 'Sorun #1: Circulation is unclear' });
    fireEvent.click(marker);
    expect(premiumProps.setSelectedFlawIndex).toHaveBeenCalledWith(0);
    expect(screen.getByText('Kırmızı Kalem Revizyonu')).toBeInTheDocument();
    expect(screen.queryByText(/1\.5 Rapido/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /yüksek çözünürlük/i })).not.toHaveTextContent(/rapido/i);
  });
});
