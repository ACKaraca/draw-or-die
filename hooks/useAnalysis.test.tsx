import { renderHook, act } from '@testing-library/react';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';
import { account } from '@/lib/appwrite';

jest.mock('@/stores/drawOrDieStore', () => ({
  useDrawOrDieStore: jest.fn(),
}));

jest.mock('@/lib/ai', () => ({
  generateAIResponse: jest.fn(),
}));

jest.mock('@/lib/growth-tracking', () => ({
  trackConversionEvent: jest.fn(),
}));

jest.mock('canvas-confetti', () => jest.fn());

jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/appwrite', () => ({
  account: {
    createJWT: jest.fn(),
  },
}));

const mockedStore = jest.mocked(useDrawOrDieStore);
const mockedAccount = jest.mocked(account);

describe('useAnalysis', () => {
  const addToast = jest.fn();
  const setStep = jest.fn();
  const setIsAuthModalOpen = jest.fn();
  const refreshProfile = jest.fn().mockResolvedValue(undefined);

  beforeAll(() => {
    global.fetch = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAccount.createJWT.mockResolvedValue({ jwt: 'test-jwt' } as never);

    mockedStore.mockReturnValue({
      imageBase64: 'data:image/png;base64,abc',
      mimeType: 'image/png',
      formData: { category: 'concept', topic: 'Test', site: '', concept: '', defense: '', harshness: 2, analysisLength: 'SHORT' },
      pdfText: null,
      isRevisionMode: false,
      previousProject: null,
      latestAnalysisKind: 'SINGLE_JURY',
      galleryPlacement: 'NONE',
      critique: 'Test critique',
      premiumData: null,
      multiData: null,
      addToast,
      setStep,
      setIsAuthModalOpen,
    } as never);
  });

  it('redirects to premium upgrade when premium rescue lacks rapido', async () => {
    const { result } = renderHook(() =>
      useAnalysis({
        user: null,
        profile: null,
        isPremiumUser: false,
        rapidoPens: 0,
        refreshProfile,
        setProfile: jest.fn(),
      })
    );

    await act(async () => {
      await result.current.handlePremium();
    });

    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('Premium analiz'),
      'info',
      6000
    );
    expect(setStep).toHaveBeenCalledWith('premium-upgrade');
  });

  it('opens auth modal when preserve is requested without logged user', async () => {
    const { result } = renderHook(() =>
      useAnalysis({
        user: null,
        profile: null,
        isPremiumUser: false,
        rapidoPens: 5,
        refreshProfile,
        setProfile: jest.fn(),
      }),
    );

    await act(async () => {
      await result.current.handlePreserveAnalysis();
    });

    expect(addToast).toHaveBeenCalledWith('Analizi korumak için giriş yapmalısınız.', 'error');
    expect(setIsAuthModalOpen).toHaveBeenCalledWith(true);
  });

  it('saves preserve analysis with preserveMode payload and refreshes profile', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ rapido_remaining: 12.5 }),
    });

    const { result } = renderHook(() =>
      useAnalysis({
        user: { id: 'user-1' } as never,
        profile: null,
        isPremiumUser: true,
        rapidoPens: 10,
        refreshProfile,
        setProfile: jest.fn(),
      }),
    );

    await act(async () => {
      await result.current.handlePreserveAnalysis();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/analysis-history',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
    expect(body.preserveMode).toBe(true);
    expect(body.sourceMimeType).toBe('image/png');
    expect(body.analysisKind).toBe('SINGLE_JURY');
    expect(refreshProfile).toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith(
      expect.stringContaining('Analiz korundu. 1.5 Rapido dusuldu.'),
      'success',
    );
  });
});
