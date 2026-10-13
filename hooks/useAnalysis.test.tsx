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

  it('refuses community share without explicit in-app confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm');

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

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledWith('Community paylaşımı onaylanmadı.', 'info');
    expect(global.fetch).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('shows moderation rejection message when community share is blocked by moderation', async () => {
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
        user: { id: 'user-1', email: 'user-1@example.com' } as never,
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
      await result.current.handleShareToCommunity({ confirmed: true });
    });

    expect(addToast).toHaveBeenCalledWith('Moderation blocked this share.', 'error');
  });

  describe('gallery publish consent', () => {
    const okGalleryResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ submissionId: 'sub-1', moderationPendingReview: true }),
    };

    function mockPlacementStore(galleryPlacement: string) {
      mockedStore.mockReturnValue({
        imageBase64: 'data:image/png;base64,abc',
        mimeType: 'image/png',
        formData: { category: 'concept', topic: 'Test', site: '', concept: '', defense: '', harshness: 2, analysisLength: 'SHORT' },
        latestAnalysisKind: 'SINGLE_JURY',
        galleryPlacement,
        critique: 'Test critique',
        premiumData: null,
        multiData: null,
        addToast,
        setStep,
        setIsAuthModalOpen,
        setGalleryConsent: jest.fn(),
        setGalleryItems: jest.fn(),
      } as never);
    }

    function renderWithUser(user: { id: string; email?: string | null }) {
      return renderHook(() =>
        useAnalysis({
          user: user as never,
          profile: null,
          isPremiumUser: false,
          rapidoPens: 10,
          getJWT,
          refreshProfile,
          setProfile: jest.fn(),
          preferredLanguage: 'tr',
        }),
      );
    }

    it('sends explicit consent and never a client approval flag when the user allows publishing', async () => {
      mockPlacementStore('HALL_OF_FAME');
      (global.fetch as jest.Mock).mockResolvedValue(okGalleryResponse);
      const { result } = renderWithUser({ id: 'user-1', email: 'user-1@example.com' });

      await act(async () => {
        await result.current.handleGalleryConsent(true);
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body as string);
      expect(body).not.toHaveProperty('autoApproved');
      expect(body).not.toHaveProperty('status');
      expect(body.consent).toEqual({ granted: true, version: expect.any(String), scope: 'HALL_OF_FAME' });
    });

    it('creates no gallery artifact when the user keeps the board private', async () => {
      mockPlacementStore('HALL_OF_FAME');
      const { result } = renderWithUser({ id: 'user-1', email: 'user-1@example.com' });

      await act(async () => {
        await result.current.handleGalleryConsent(false);
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('blocks guest publishing on the client before any request', async () => {
      mockPlacementStore('WALL_OF_DEATH');
      const { result } = renderWithUser({ id: 'guest-1', email: null });

      await act(async () => {
        await result.current.handleGalleryConsent(true);
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(setIsAuthModalOpen).toHaveBeenCalledWith(true);
    });
  });

  describe('analysis flows', () => {
    const storeActions = {
      setCritique: jest.fn(),
      setGalleryPlacement: jest.fn(),
      setGalleryConsent: jest.fn(),
      setPreviousProject: jest.fn(),
      setLatestAnalysisKind: jest.fn(),
      setLastProgression: jest.fn(),
      setFormData: jest.fn(),
      setPremiumData: jest.fn(),
      setMultiData: jest.fn(),
    };

    function mockAnalysisStore(overrides: Record<string, unknown> = {}) {
      mockedStore.mockReturnValue({
        step: 'upload',
        image: null,
        imageBase64: 'abc',
        mimeType: 'image/png',
        additionalUploads: [],
        formData: {
          category: 'concept',
          topic: 'Test',
          site: '',
          concept: '',
          defense: '',
          harshness: 2,
          analysisLength: 'SHORT',
          singlePersonaId: 'constructive',
          multiPersonaIds: ['structural', 'conceptual'],
        },
        pdfText: null,
        isRevisionMode: false,
        previousProject: null,
        latestAnalysisKind: 'SINGLE_JURY',
        galleryPlacement: 'NONE',
        critique: null,
        premiumData: null,
        multiData: null,
        addToast,
        setStep,
        setIsAuthModalOpen,
        ...storeActions,
        ...overrides,
      } as never);
    }

    function renderAnalysisHook(isPremiumUser = false) {
      return renderHook(() =>
        useAnalysis({
          user: { id: 'user-1' } as never,
          profile: null,
          isPremiumUser,
          rapidoPens: 50,
          getJWT,
          refreshProfile,
          setProfile: jest.fn(),
          preferredLanguage: 'tr',
        }),
      );
    }

    const mockedGenerate = jest.requireMock('@/lib/ai').generateAIResponse as jest.Mock;

    it('never publishes a free user board to the gallery without consent', async () => {
      mockAnalysisStore();
      mockedGenerate.mockResolvedValueOnce({
        result: JSON.stringify({ critique: 'Strong parti.', score: 92, galleryPlacement: 'HALL_OF_FAME' }),
      });

      const { result } = renderAnalysisHook(false);
      await act(async () => {
        await result.current.handleAnalyze();
      });

      expect(storeActions.setGalleryPlacement).toHaveBeenCalledWith('HALL_OF_FAME');
      expect(storeActions.setGalleryConsent).toHaveBeenCalledWith(null);
      expect(storeActions.setGalleryConsent).not.toHaveBeenCalledWith(true);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(setStep).toHaveBeenLastCalledWith('result');
    });

    it('ignores a second paid analysis click while the first is in flight', async () => {
      mockAnalysisStore();
      let resolveAnalysis: (value: unknown) => void = () => {};
      mockedGenerate.mockReturnValueOnce(new Promise((resolve) => { resolveAnalysis = resolve; }));

      const { result } = renderAnalysisHook(true);
      let first: Promise<unknown> = Promise.resolve();
      await act(async () => {
        first = result.current.handleAnalyze();
        await result.current.handleAnalyze();
      });

      expect(mockedGenerate).toHaveBeenCalledTimes(1);
      await act(async () => {
        resolveAnalysis({ result: JSON.stringify({ critique: 'Done', score: 50 }) });
        await first;
      });
    });

    it('maps structured error codes to friendly copy instead of raw codes', async () => {
      mockAnalysisStore();
      mockedGenerate.mockRejectedValueOnce(new Error('INSUFFICIENT_RAPIDO:4:2'));

      const { result } = renderAnalysisHook(true);
      await act(async () => {
        await result.current.handleAnalyze();
      });

      const [message, type] = addToast.mock.calls.at(-1) as [string, string];
      expect(type).toBe('error');
      expect(message).toContain('4 Rapido');
      expect(message).toContain('mevcut: 2');
      expect(message).not.toContain('INSUFFICIENT_RAPIDO');
    });

    it('never shows an unknown machine code to the user', async () => {
      mockAnalysisStore();
      mockedGenerate.mockRejectedValueOnce(new Error('SOME_NEW_CODE:7'));

      const { result } = renderAnalysisHook(true);
      await act(async () => {
        await result.current.handleAnalyze();
      });

      expect(addToast).toHaveBeenLastCalledWith('Bir hata oluştu. Lütfen tekrar dene.', 'error');
    });

    it('keeps the previous board as the "before" image after a revision', async () => {
      const previousProject = { imageBase64: 'old-board', mimeType: 'image/jpeg', critique: 'Old critique' };
      mockAnalysisStore({ isRevisionMode: true, previousProject, imageBase64: 'new-board' });
      mockedGenerate.mockResolvedValueOnce({
        result: JSON.stringify({ critique: 'Better', score: 70, isSameProject: true, progressionScore: 10 }),
      });

      const { result } = renderAnalysisHook(true);
      await act(async () => {
        await result.current.handleAnalyze();
      });

      expect(mockedGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'REVISION_SAME',
          params: expect.objectContaining({ previousCritique: 'Old critique' }),
        }),
      );
      expect(storeActions.setPreviousProject).toHaveBeenLastCalledWith(previousProject);
      expect(storeActions.setLatestAnalysisKind).toHaveBeenCalledWith('REVISION_SAME');
    });

    it('appends the skill roadmap below the existing report instead of replacing it', async () => {
      mockAnalysisStore({ step: 'result', critique: 'Original jury critique' });
      mockedGenerate.mockResolvedValueOnce({
        result: JSON.stringify({ critique: 'Week 1: section drills', score: 60 }),
      });

      const { result } = renderAnalysisHook(true);
      await act(async () => {
        await result.current.handleDesignInsight('SKILL_ROADMAP');
      });

      const savedCritique = storeActions.setCritique.mock.calls.at(-1)?.[0] as string;
      expect(savedCritique.startsWith('Original jury critique')).toBe(true);
      expect(savedCritique).toContain('## ◈ Kişisel Beceri Rotası');
      expect(savedCritique).toContain('Week 1: section drills');
      expect(storeActions.setLatestAnalysisKind).not.toHaveBeenCalled();
      expect(storeActions.setGalleryPlacement).not.toHaveBeenCalled();
      expect(setStep).toHaveBeenLastCalledWith('result');
    });

    it('returns to the multi-jury result when Premium Rescue fails after a multi run', async () => {
      mockAnalysisStore({
        step: 'multi-result',
        multiData: { personas: [{ id: 'structural', name: 'Structural', critique: 'x', score: 40 }] },
      });
      mockedGenerate.mockRejectedValueOnce(new Error('RATE_LIMITED:30'));

      const { result } = renderAnalysisHook(true);
      await act(async () => {
        await result.current.handlePremium();
      });

      expect(setStep).toHaveBeenCalledWith('premium-analyzing');
      expect(setStep).toHaveBeenLastCalledWith('multi-result');
      expect(addToast).toHaveBeenLastCalledWith(expect.stringContaining('30 sn'), 'error');
    });

    it('does not charge twice for preserving the same analysis', async () => {
      mockAnalysisStore({ critique: 'Preserve me' });
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ rapido_remaining: 10 }),
      });

      const { result } = renderAnalysisHook(true);
      let firstResult = false;
      let secondResult = false;
      await act(async () => {
        firstResult = await result.current.handlePreserveAnalysis();
      });
      await act(async () => {
        secondResult = await result.current.handlePreserveAnalysis();
      });

      expect(firstResult).toBe(true);
      expect(secondResult).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(addToast).toHaveBeenLastCalledWith('Bu analiz zaten korundu.', 'info');
    });
  });
});
