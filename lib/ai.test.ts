import { generateAIResponse } from '@/lib/ai';
import { account } from '@/lib/appwrite';

jest.mock('@/lib/appwrite', () => ({
  account: {
    createJWT: jest.fn(),
  },
}));

const mockedAccount = jest.mocked(account);
const mockedFetch = jest.fn();

describe('generateAIResponse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockedAccount.createJWT.mockResolvedValue({ jwt: 'jwt-token' } as never);
    mockedFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ result: 'ok', rapido_remaining: 3 }),
      clone: jest.fn(),
    });
    global.fetch = mockedFetch as unknown as typeof fetch;
  });

  it('throws when there is no active session', async () => {
    mockedAccount.createJWT.mockRejectedValueOnce(new Error('no session'));

    await expect(generateAIResponse({ operation: 'SINGLE_JURY' })).rejects.toThrow(
      'Oturum bulunamadı. Lütfen giriş yapın.'
    );
  });

  it('uses the refreshed access token when one is returned', async () => {
    mockedAccount.createJWT.mockResolvedValueOnce({ jwt: 'refreshed-token' } as never);
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ result: 'analysis', rapido_remaining: 8 }),
      clone: jest.fn(),
    });

    const response = await generateAIResponse({
      operation: 'SINGLE_JURY',
      imageBase64: 'abc',
      imageMimeType: 'image/png',
      params: { harshness: 4 },
    });

    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/ai-generate',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer refreshed-token',
          'Accept-Language': 'tr',
        }),
        body: expect.any(String),
      })
    );
    const payload = JSON.parse((mockedFetch.mock.calls[0][1] as { body: string }).body);
    expect(payload).toEqual({
      operation: 'SINGLE_JURY',
      imageBase64: 'abc',
      imageMimeType: 'image/png',
      params: { harshness: 4 },
    });
    expect(response).toEqual({ result: 'analysis', rapido_remaining: 8, game_state: undefined });
  });

  it('defaults params to an empty object and rapido_remaining to zero', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ result: 'analysis only' }),
      clone: jest.fn(),
    });

    const response = await generateAIResponse({ operation: 'AI_MENTOR' });

    const payload = JSON.parse((mockedFetch.mock.calls[0][1] as { body: string }).body);
    expect(payload.params).toEqual({});
    expect(response).toEqual({ result: 'analysis only', rapido_remaining: 0, game_state: undefined });
  });

  it('returns null when the edge function succeeds without a result payload', async () => {
    mockedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ rapido_remaining: 4 }),
      clone: jest.fn(),
    });

    await expect(generateAIResponse({ operation: 'AUTO_CONCEPT' })).resolves.toBeNull();
  });

  it('maps structured premium errors to the expected sentinel error', async () => {
    const json = jest.fn().mockResolvedValue({
      error: 'Premium gerekli',
      code: 'PREMIUM_REQUIRED',
      status: 403,
    });
    const text = jest.fn().mockResolvedValue('Premium gerekli');
    const clone = jest.fn().mockReturnValue({ json, text });
    mockedFetch.mockResolvedValueOnce({ ok: false, status: 403, clone });

    await expect(generateAIResponse({ operation: 'MULTI_JURY' })).rejects.toThrow('PREMIUM_REQUIRED');
  });

  it('maps structured rapido errors to the expected sentinel format', async () => {
    const json = jest.fn().mockResolvedValue({
      error: 'Yetersiz rapido',
      code: 'INSUFFICIENT_RAPIDO',
      required: 5,
      available: 2,
      status: 402,
    });
    const text = jest.fn().mockResolvedValue('Yetersiz rapido');
    const clone = jest.fn().mockReturnValue({ json, text });
    mockedFetch.mockResolvedValueOnce({ ok: false, status: 402, clone });

    await expect(generateAIResponse({ operation: 'DEFENSE' })).rejects.toThrow(
      'INSUFFICIENT_RAPIDO:5:2'
    );
  });

  it('falls back to text extraction when structured json parsing fails', async () => {
    const json = jest.fn().mockRejectedValue(new Error('bad json'));
    const text = jest.fn().mockResolvedValue('Edge function failed');
    const clone = jest.fn().mockReturnValue({ json, text });
    mockedFetch.mockResolvedValueOnce({ ok: false, status: 500, clone });

    await expect(generateAIResponse({ operation: 'SINGLE_JURY' })).rejects.toThrow(
      'Edge function failed'
    );
  });

  it('surfaces timeout failures with a user-facing timeout message', async () => {
    jest.useFakeTimers();
    mockedFetch.mockImplementation(() => new Promise(() => undefined));

    const pending = generateAIResponse({ operation: 'SINGLE_JURY' });
    const assertion = expect(pending).rejects.toThrow('İstek zaman aşımına uğradı. Tekrar deneyin.');
    await jest.advanceTimersByTimeAsync(120_000);
    await assertion;
  });
});
