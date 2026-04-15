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

  it('renders gallery consent actions and opens the revision comparison toggle', async () => {
    const handleGalleryConsent = jest.fn();

    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          galleryConsent: null,
          isPremiumUser: true,
          galleryPlacement: 'HALL_OF_FAME',
          handleGalleryConsent,
          previousProject: {
            mimeType: 'image/png',
            imageBase64: 'data:image/png;base64,abc',
          },
        })}
      />,
    );

    fireEvent.click(screen.getByText('İzin Ver'));
    fireEvent.click(screen.getByText('Gizli Tut'));
    expect(handleGalleryConsent).toHaveBeenNthCalledWith(1, true);
    expect(handleGalleryConsent).toHaveBeenNthCalledWith(2, false);

    fireEvent.click(screen.getByRole('button', { name: /evrim görünümü/i }));
    expect(screen.getByAltText('Önce')).toBeTruthy();
    expect(screen.getByAltText('Sonra')).toBeTruthy();
  });

  it('calls preserve handler from result step action', () => {
    const handlePreserveAnalysis = jest.fn();

    render(
      <ResultStep
        {...baseResultProps({
          isAnonymous: false,
          guestDrawingCount: 2,
          handlePreserveAnalysis,
        })}
      />,
    );

    fireEvent.click(screen.getByText('Analizi Koru (1.5 Rapido)'));
    expect(handlePreserveAnalysis).toHaveBeenCalledTimes(1);
  });

  it('calls preserve handler from multi result step action', () => {
    const handlePreserveAnalysis = jest.fn();

    render(<MultiResultStep {...baseMultiProps({ handlePreserveAnalysis })} />);

    fireEvent.click(screen.getByText('Analizi Koru (1.5 Rapido)'));
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

    fireEvent.click(screen.getByTitle('Analizi Koru'));
    expect(premiumProps.handlePreserveAnalysis).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });
});
