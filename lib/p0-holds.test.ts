const mockGetFeatureFlag = jest.fn();

jest.mock('@/lib/appwrite/server', () => ({
  getFeatureFlag: (...args: unknown[]) => mockGetFeatureFlag(...args),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      headers: init?.headers ?? {},
      json: async () => body,
    }),
  },
}));

import {
  getHoldFlagKey,
  holdUnavailablePayload,
  isHoldActive,
  parseHoldRelease,
  rejectIfHeld,
  resetHoldCache,
} from '@/lib/p0-holds';

const RELEASE = {
  state: 'released',
  owner: 'incident-owner',
  reason: 'DOD-4 verified',
  environment: 'test',
  configVersion: '2026-10-14.1',
  startedAt: '2026-10-14T00:00:00Z',
  reviewAt: '2026-10-15T00:00:00Z',
  reenableGate: 'permanent branch accepted',
};

function releasedRow(overrides: Record<string, unknown> = {}) {
  return { enabled: false, value_json: JSON.stringify({ ...RELEASE, ...overrides }) };
}

describe('parseHoldRelease', () => {
  it('accepts a complete release record for the current environment', () => {
    expect(parseHoldRelease(releasedRow(), 'test')).toMatchObject({ state: 'released', owner: 'incident-owner' });
  });

  it.each([
    ['no row', null],
    ['hold still enabled', { enabled: true, value_json: JSON.stringify(RELEASE) }],
    ['no record', { enabled: false }],
    ['malformed JSON', { enabled: false, value_json: '{not json' }],
    ['non-object JSON', { enabled: false, value_json: '[]' }],
    ['state not released', releasedRow({ state: 'held' })],
    ['missing owner', releasedRow({ owner: '' })],
    ['missing re-enable gate', releasedRow({ reenableGate: undefined })],
    ['other environment', releasedRow({ environment: 'production' })],
  ])('keeps the hold active for %s', (_label, row) => {
    expect(parseHoldRelease(row as never, 'test')).toBeNull();
  });
});

describe('isHoldActive', () => {
  beforeEach(() => {
    resetHoldCache();
    mockGetFeatureFlag.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('is active when no release row exists', async () => {
    mockGetFeatureFlag.mockResolvedValue(null);
    await expect(isHoldActive('checkout')).resolves.toBe(true);
    expect(mockGetFeatureFlag).toHaveBeenCalledWith(getHoldFlagKey('checkout'));
  });

  it('is released only with a valid record', async () => {
    mockGetFeatureFlag.mockResolvedValue(releasedRow());
    await expect(isHoldActive('checkout')).resolves.toBe(false);
  });

  it('fails closed when the flag table cannot be read', async () => {
    mockGetFeatureFlag.mockRejectedValue(new Error('appwrite down'));
    await expect(isHoldActive('rewards')).resolves.toBe(true);
  });

  it('caches the result so a burst of requests reads the table once', async () => {
    mockGetFeatureFlag.mockResolvedValue(releasedRow());
    await isHoldActive('gallery_public');
    await isHoldActive('gallery_public');
    expect(mockGetFeatureFlag).toHaveBeenCalledTimes(1);
  });
});

describe('rejectIfHeld', () => {
  beforeEach(() => {
    resetHoldCache();
    mockGetFeatureFlag.mockReset();
  });

  it('returns a truthful 503 with the hold id while held', async () => {
    mockGetFeatureFlag.mockResolvedValue(null);
    const response = await rejectIfHeld('paid_ai_wallet', 'en');

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual(holdUnavailablePayload('paid_ai_wallet', 'en'));
    expect(holdUnavailablePayload('paid_ai_wallet', 'en').error).toContain('preserved');
  });

  it('returns null once the hold is released', async () => {
    mockGetFeatureFlag.mockResolvedValue(releasedRow());
    await expect(rejectIfHeld('paid_ai_wallet', 'tr')).resolves.toBeNull();
  });
});
