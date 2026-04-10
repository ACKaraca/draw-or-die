import {
  __resetRateLimitStore,
  checkRateLimit,
  RATE_LIMITS,
  type RateLimitConfig,
} from '@/lib/rate-limit';

describe('rate-limit', () => {
  const config: RateLimitConfig = { maxRequests: 3, windowMs: 1_000 };

  beforeEach(() => {
    jest.restoreAllMocks();
    __resetRateLimitStore();
  });

  it('allows the first request and initializes the window', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);

    const result = await checkRateLimit('first-user', config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetAt).toBe(11_000);
  });

  it('decrements remaining requests within the same window', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);

    const first = await checkRateLimit('repeat-user', config);
    const second = await checkRateLimit('repeat-user', config);
    const third = await checkRateLimit('repeat-user', config);

    expect(first.remaining).toBe(2);
    expect(second.remaining).toBe(1);
    expect(third.remaining).toBe(0);
  });

  it('blocks requests after the max request count is reached', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);

    await checkRateLimit('limited-user', config);
    await checkRateLimit('limited-user', config);
    await checkRateLimit('limited-user', config);
    const blocked = await checkRateLimit('limited-user', config);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBe(11_000);
  });

  it('resets the window after expiration', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(10_000);
    await checkRateLimit('reset-user', config);
    await checkRateLimit('reset-user', config);

    nowSpy.mockReturnValue(11_001);
    const result = await checkRateLimit('reset-user', config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetAt).toBe(12_001);
  });

  it('tracks rate limits per key independently', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(10_000);

    await checkRateLimit('user-a', config);
    await checkRateLimit('user-a', config);
    const userB = await checkRateLimit('user-b', config);

    expect(userB.allowed).toBe(true);
    expect(userB.remaining).toBe(2);
  });

  it('exposes stricter presets for sensitive operations', () => {
    expect(RATE_LIMITS.AI_OPERATION.maxRequests).toBeLessThan(RATE_LIMITS.GENERAL.maxRequests);
    expect(RATE_LIMITS.AI_MENTOR.maxRequests).toBeGreaterThan(RATE_LIMITS.AI_OPERATION.maxRequests);
    expect(RATE_LIMITS.AI_MENTOR.maxRequests).toBeLessThan(RATE_LIMITS.GENERAL.maxRequests);
    expect(RATE_LIMITS.CHECKOUT.maxRequests).toBeLessThan(RATE_LIMITS.GENERAL.maxRequests);
    expect(RATE_LIMITS.AI_OPERATION.windowMs).toBe(RATE_LIMITS.GENERAL.windowMs);
    expect(RATE_LIMITS.AI_MENTOR.windowMs).toBe(RATE_LIMITS.GENERAL.windowMs);
  });
});
