import { renderHook, act } from '@testing-library/react';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useDrawOrDieStore } from '@/stores/drawOrDieStore';

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

const mockedStore = jest.mocked(useDrawOrDieStore);
const getJWT = jest.fn().mockResolvedValue('test-jwt');

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
    getJWT.mockResolvedValue('test-jwt');

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
        getJWT,
        refreshProfile,
        setProfile: jest.fn(),
        preferredLanguage: 'tr',
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
        getJWT,
        refreshProfile,
        setProfile: jest.fn(),
        preferredLanguage: 'tr',
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
        getJWT,
        refreshProfile,
        setProfile: jest.fn(),
        preferredLanguage: 'tr',
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
      expect.stringMatching(/Analiz korundu.*1\.5 Rapido düşüldü/),
      'success',
    );
  });

  it('requires authentication before community share', async () => {
    const { result } = renderHook(() =>
      useAnalysis({
        user: null,
        profile: null,
        isPremiumUser: false,
        rapidoPens: 5,
        getJWT,
        refreshProfile,
        setProfile: jest.fn(),
        preferredLanguage: 'tr',
      }),
    );

    await act(async () => {
      await result.current.handleShareToCommunity();
    });

    expect(addToast).toHaveBeenCalledWith('Community paylaşımı için giriş yapmalısınız.', 'error');
    expect(setIsAuthModalOpen).toHaveBeenCalledWith(true);
  });

  it('aborts community share when confirmation is cancelled', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

    const { result } = renderHook(() =>
      useAnalysis({
        user: { id: 'user-1' } as never,
        profile: null,
        isPremiumUser: true,
        rapidoPens: 10,
        getJWT,
        refreshProfile,
        setProfile: jest.fn(),
        preferredLanguage: 'tr',
      }),
    );

    await act(async () => {
      await result.current.handleShareToCommunity();
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith('Community paylaşımı onaylanmadı.', 'info');
    expect(global.fetch).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('shows moderation rejection message when community share is blocked by moderation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      text: jest.fn().mockResolvedValue(JSON.stringify({
        code: 'COMMUNITY_MODERATION_REJECTED',
        error: 'Moderation blocked this share.',
      })),
    });

    const { result } = renderHook(() =>
      useAnalysis({
        user: { id: 'user-1' } as never,
        profile: null,
        isPremiumUser: true,
        rapidoPens: 10,
        getJWT,
        refreshProfile,
        setProfile: jest.fn(),
        preferredLanguage: 'tr',
      }),
    );

    await act(async () => {
      await result.current.handleShareToCommunity();
    });

    expect(addToast).toHaveBeenCalledWith('Moderation blocked this share.', 'error');
    confirmSpy.mockRestore();
  });
});
