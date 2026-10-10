jest.mock('@/lib/logger', () => ({
  logServerInfo: jest.fn(),
}));

import { callAI, type AIConfig } from '@/lib/ai-completion';
import { SINGLE_JURY_RESPONSE_FORMAT } from '@/lib/ai-response-formats';

const GATEWAY_CONFIG: AIConfig = {
  baseUrl: 'https://ai-gateway.vercel.sh/v1',
  apiKey: 'test-key',
  model: 'google/gemini-3.1-flash-lite-preview',
};

const mockedFetch = jest.fn();

function okResponse(content: string, model = GATEWAY_CONFIG.model) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: async () => ({
      model,
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }),
    text: async () => '',
  };
}

function errorResponse(status: number, body = '{}') {
  return {
    ok: false,
    status,
    headers: new Headers(),
    json: async () => JSON.parse(body),
    text: async () => body,
  };
}

function sentBody(callIndex: number): Record<string, unknown> {
  const init = mockedFetch.mock.calls[callIndex][1] as { body: string };
  return JSON.parse(init.body) as Record<string, unknown>;
}

describe('callAI', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockedFetch.mockReset();
    global.fetch = mockedFetch as unknown as typeof fetch;
    process.env = { ...originalEnv };
    delete process.env.AI_STRUCTURED_OUTPUTS;
    delete process.env.AI_REASONING_EFFORT;
    delete process.env.AI_REASONING_EFFORT_FAST;
    delete process.env.AI_MODEL_FALLBACKS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('sends the strict schema and the gateway fallback model, and returns the content', async () => {
    mockedFetch.mockResolvedValueOnce(okResponse('{"critique":"ok"}'));

    const result = await callAI(GATEWAY_CONFIG, 'prompt', 'abc', 'image/png', [], 'en', SINGLE_JURY_RESPONSE_FORMAT, {
      operation: 'SINGLE_JURY',
      requestId: 'req_1',
    });

    expect(result.content).toBe('{"critique":"ok"}');
    expect(result.usage?.totalTokens).toBe(15);
    const body = sentBody(0);
    expect(body.response_format).toEqual(SINGLE_JURY_RESPONSE_FORMAT);
    expect(body.models).toEqual(['google/gemini-2.5-flash-lite']);
    expect(body.reasoning_effort).toBeUndefined();
    const init = mockedFetch.mock.calls[0][1] as { signal?: AbortSignal };
    expect(init.signal).toBeDefined();
  });

  it('retries a transient provider error once on the fallback model', async () => {
    mockedFetch
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse('{"critique":"retried"}', 'google/gemini-2.5-flash-lite'));

    const result = await callAI(GATEWAY_CONFIG, 'prompt', undefined, undefined, [], 'en', undefined, {
      operation: 'DEFENSE',
      requestId: 'req_2',
    });

    expect(result.content).toBe('{"critique":"retried"}');
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(sentBody(1).model).toBe('google/gemini-2.5-flash-lite');
  });

  it('retries a network failure once', async () => {
    mockedFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(okResponse('{}'));

    await expect(callAI(GATEWAY_CONFIG, 'prompt')).resolves.toEqual(expect.objectContaining({ content: '{}' }));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient provider error', async () => {
    mockedFetch.mockResolvedValueOnce(errorResponse(400, '{"error":{"message":"bad request"}}'));

    await expect(callAI(GATEWAY_CONFIG, 'prompt')).rejects.toEqual(expect.objectContaining({
      isProviderFailure: true,
      providerStatus: 400,
    }));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry after a timeout and reports it as 504', async () => {
    const timeoutError = new Error('The operation was aborted due to timeout');
    timeoutError.name = 'TimeoutError';
    mockedFetch.mockRejectedValueOnce(timeoutError);

    await expect(callAI(GATEWAY_CONFIG, 'prompt')).rejects.toEqual(expect.objectContaining({
      isProviderFailure: true,
      providerStatus: 504,
    }));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after the second failed attempt', async () => {
    mockedFetch
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(errorResponse(429));

    await expect(callAI(GATEWAY_CONFIG, 'prompt')).rejects.toEqual(expect.objectContaining({ providerStatus: 429 }));
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it('honours the structured-output kill switch', async () => {
    process.env.AI_STRUCTURED_OUTPUTS = 'off';
    mockedFetch.mockResolvedValueOnce(okResponse('{}'));

    await callAI(GATEWAY_CONFIG, 'prompt', undefined, undefined, [], 'en', SINGLE_JURY_RESPONSE_FORMAT);

    expect(sentBody(0).response_format).toBeUndefined();
  });

  it('applies the fast reasoning effort only to latency-sensitive operations', async () => {
    process.env.AI_REASONING_EFFORT_FAST = 'low';
    mockedFetch.mockResolvedValue(okResponse('{}'));

    await callAI(GATEWAY_CONFIG, 'prompt', undefined, undefined, [], 'en', undefined, { operation: 'DEFENSE', requestId: 'a' });
    await callAI(GATEWAY_CONFIG, 'prompt', undefined, undefined, [], 'en', undefined, { operation: 'SINGLE_JURY', requestId: 'b' });

    expect(sentBody(0).reasoning_effort).toBe('low');
    expect(sentBody(1).reasoning_effort).toBeUndefined();
  });

  it('rejects providers outside the allowlist', async () => {
    await expect(callAI({ ...GATEWAY_CONFIG, baseUrl: 'https://evil.example.com/v1' }, 'prompt'))
      .rejects.toThrow('AI provider not in allowlist');
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});
