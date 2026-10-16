/** @jest-environment node */
import type { NextRequest } from 'next/server';

type MockRow = Record<string, unknown> & { $id: string; user_id: string };
type MockUser = { id: string; email: string | null; name: string | null; emailVerified?: boolean; createdAt?: string };

const mockRows = new Map<string, MockRow>();
const mockUsers = new Map<string, MockUser>();
const mockLedger = new Set<string>();
const mockSentEmails: string[] = [];
const mockLogs: unknown[] = [];
const mockDelivery = { shouldFail: false };

const mockTick = () => new Promise<void>((resolve) => setImmediate(resolve));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('node-appwrite', () => ({
  ID: { unique: () => `id-${Math.random().toString(36).slice(2)}` },
  MessagingProviderType: { Email: 'email' },
  Users: jest.fn().mockImplementation(() => ({
    listTargets: async () => ({ targets: [] }),
    createTarget: async () => ({ $id: 'target-1', providerType: 'email' }),
    updateTarget: async () => ({ $id: 'target-1' }),
  })),
  Messaging: jest.fn().mockImplementation(() => ({
    createEmail: async ({ content }: { content: string }) => {
      mockSentEmails.push(content);
      if (mockDelivery.shouldFail) throw new Error('provider down');
      return {};
    },
  })),
  Query: {},
}));

jest.mock('@/lib/appwrite/server', () => {
  const actual = jest.requireActual('@/lib/appwrite/server');
  return {
    APPWRITE_DATABASE_ID: 'db',
    APPWRITE_TABLE_PROFILES_ID: 'profiles',
    createAdminClient: () => ({}),
    getAuthenticatedUserFromRequest: async (request: { headers: Headers }) => {
      const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
      return mockUsers.get(token) ?? null;
    },
    getOrCreateProfile: async (user: MockUser) => {
      await mockTick();
      return actual.normalizeProfileRow({ ...mockRows.get(user.id) });
    },
    updateProfileById: async (userId: string, data: Record<string, unknown>) => {
      await mockTick();
      const row = mockRows.get(userId);
      if (!row) throw new Error('missing row');
      Object.assign(row, data);
      return { ...row };
    },
    getAdminTables: () => ({
      incrementRowColumn: async (params: { rowId: string; column: string; value: number; max?: number }) => {
        await mockTick();
        const row = [...mockRows.values()].find((entry) => entry.$id === params.rowId);
        if (!row) throw new Error('missing row');
        const next = Number(row[params.column] ?? 0) + params.value;
        if (params.max !== undefined && next > params.max) throw Object.assign(new Error('limit'), { code: 400 });
        row[params.column] = next;
        return { ...row };
      },
    }),
  };
});

jest.mock('@/lib/idempotency', () => ({
  claimOnce: async (key: string) => {
    await mockTick();
    if (mockLedger.has(key)) return false;
    mockLedger.add(key);
    return true;
  },
  releaseClaim: async (key: string) => {
    mockLedger.delete(key);
  },
}));

jest.mock('@/lib/appwrite/resource-bootstrap', () => ({ ensureCoreAppwriteResources: async () => undefined }));

jest.mock('@/lib/logger', () => ({
  logServerError: (...args: unknown[]) => mockLogs.push(args),
  logServerInfo: (...args: unknown[]) => mockLogs.push(args),
}));

import { POST, PUT } from '@/app/api/verify-edu/route';
import { __resetRateLimitStore } from '@/lib/rate-limit';

const EDU_EMAIL = 'student@akdeniz.edu.tr';

function addUser(id: string, overrides: Partial<MockUser> = {}): void {
  mockUsers.set(`jwt-${id}`, { id, email: `${id}@example.com`, name: id, emailVerified: true, ...overrides });
  mockRows.set(id, { $id: id, user_id: id, email: `${id}@example.com`, rapido_pens: 15, referral_code: `REF${id}` });
}

function makeRequest(userId: string | null, body: unknown, ip = '10.0.0.1'): NextRequest {
  const headers = new Headers({ 'x-forwarded-for': ip });
  if (userId) headers.set('authorization', `Bearer jwt-${userId}`);
  return { headers, json: async () => body } as unknown as NextRequest;
}

type Handler = (request: NextRequest) => Promise<{ status: number; json: () => Promise<unknown> }>;

async function call(handler: Handler, userId: string | null, body: unknown, ip?: string) {
  const response = await handler(makeRequest(userId, body, ip));
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

function lastSentCode(): string {
  const match = mockSentEmails.at(-1)?.match(/>(\d{6})</);
  if (!match) throw new Error('no code was sent');
  return match[1];
}

function wrongCode(code: string): string {
  return code === '000000' ? '000001' : '000000';
}

describe('/api/verify-edu production handlers', () => {
  beforeEach(() => {
    mockRows.clear();
    mockUsers.clear();
    mockLedger.clear();
    mockSentEmails.length = 0;
    mockLogs.length = 0;
    mockDelivery.shouldFail = false;
    __resetRateLimitStore();
    addUser('alice');
    addUser('bob');
  });

  it('mails the code, stores only a keyed hash and verifies once', async () => {
    const start = await call(POST, 'alice', { email: EDU_EMAIL });
    expect(start.status).toBe(200);
    const code = lastSentCode();

    expect(JSON.stringify(start.body)).not.toContain(code);
    const row = mockRows.get('alice')!;
    expect(row.edu_verification_code).toBe('');
    expect(row.edu_otp_hash).toMatch(/^v1:[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(code);
    expect(JSON.stringify(mockLogs)).not.toContain(code);

    const confirm = await call(PUT, 'alice', { code });
    expect(confirm).toEqual({ status: 200, body: expect.objectContaining({ verified: true }) });
    expect(row).toEqual(expect.objectContaining({
      edu_verified: true,
      edu_email: EDU_EMAIL,
      edu_otp_hash: '',
      edu_otp_challenge_id: '',
      edu_verification_code: '',
    }));

    const replay = await call(PUT, 'alice', { code });
    expect(replay.status).toBe(400);
    expect(replay.body.verified).toBeUndefined();
  });

  it('accepts at most one of many concurrent confirmations', async () => {
    await call(POST, 'alice', { email: EDU_EMAIL });
    const code = lastSentCode();

    const results = await Promise.all(Array.from({ length: 5 }, () => call(PUT, 'alice', { code })));
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
  });

  it('rejects wrong codes and blocks guessing without mailbox access', async () => {
    await call(POST, 'alice', { email: EDU_EMAIL });
    const code = lastSentCode();

    for (let i = 0; i < 5; i += 1) {
      expect((await call(PUT, 'alice', { code: wrongCode(code) })).status).toBe(400);
    }
    // Further guesses are cut off (per-user rate limit and attempt budget are both spent).
    expect((await call(PUT, 'alice', { code })).status).toBe(429);
    expect(mockRows.get('alice')!.edu_verified).toBeUndefined();
  });

  it('invalidates the challenge once its attempt budget is spent', async () => {
    await call(POST, 'alice', { email: EDU_EMAIL });
    const code = lastSentCode();
    mockRows.get('alice')!.edu_otp_attempts = 5;

    const result = await call(PUT, 'alice', { code });
    expect(result.status).toBe(429);
    expect(mockRows.get('alice')!.edu_otp_hash).toBe('');
    expect(mockRows.get('alice')!.edu_verified).toBeUndefined();
  });

  it('rejects an expired code and clears it', async () => {
    await call(POST, 'alice', { email: EDU_EMAIL });
    const code = lastSentCode();
    mockRows.get('alice')!.edu_verification_expires = new Date(Date.now() - 1000).toISOString();

    expect((await call(PUT, 'alice', { code })).status).toBe(400);
    expect(mockRows.get('alice')!.edu_otp_hash).toBe('');
  });

  it('rejects a superseded code', async () => {
    await call(POST, 'alice', { email: EDU_EMAIL });
    const firstCode = lastSentCode();
    await call(POST, 'alice', { email: EDU_EMAIL });
    const secondCode = lastSentCode();
    if (firstCode === secondCode) return; // 1-in-a-million collision: nothing to distinguish.

    expect((await call(PUT, 'alice', { code: firstCode })).status).toBe(400);
    expect((await call(PUT, 'alice', { code: secondCode })).status).toBe(200);
  });

  it("rejects another user's code and a tampered target email", async () => {
    await call(POST, 'alice', { email: EDU_EMAIL });
    const aliceCode = lastSentCode();
    await call(POST, 'bob', { email: 'bob@metu.edu.tr' });

    expect((await call(PUT, 'bob', { code: aliceCode })).status).toBe(400);

    mockRows.get('alice')!.edu_verification_email = 'attacker@metu.edu.tr';
    expect((await call(PUT, 'alice', { code: aliceCode })).status).toBe(400);
    expect(mockRows.get('alice')!.edu_verified).toBeUndefined();
  });

  it('never accepts legacy plaintext codes and clears them', async () => {
    Object.assign(mockRows.get('alice')!, {
      edu_verification_code: '123456',
      edu_verification_email: EDU_EMAIL,
      edu_verification_expires: new Date(Date.now() + 60_000).toISOString(),
    });

    expect((await call(PUT, 'alice', { code: '123456' })).status).toBe(400);
    expect(mockRows.get('alice')!.edu_verification_code).toBe('');
    expect(mockRows.get('alice')!.edu_verified).toBeUndefined();
  });

  it('does not expose or keep a usable code when delivery fails', async () => {
    mockDelivery.shouldFail = true;
    const start = await call(POST, 'alice', { email: EDU_EMAIL });
    const code = lastSentCode();

    expect(start.status).toBe(502);
    expect(JSON.stringify(start.body)).not.toContain(code);
    expect(start.body.devOtp).toBeUndefined();
    expect(mockRows.get('alice')!.edu_otp_hash).toBe('');

    expect((await call(PUT, 'alice', { code })).status).toBe(400);
  });

  it('rejects a code whose delivery was never confirmed', async () => {
    await call(POST, 'alice', { email: EDU_EMAIL });
    const code = lastSentCode();
    mockRows.get('alice')!.edu_otp_delivery = 'pending';

    expect((await call(PUT, 'alice', { code })).status).toBe(400);
  });

  it('gives the same answer for no challenge, wrong, expired and replayed codes', async () => {
    const noChallenge = await call(PUT, 'bob', { code: '123456' });

    await call(POST, 'alice', { email: EDU_EMAIL });
    const code = lastSentCode();
    const wrong = await call(PUT, 'alice', { code: wrongCode(code) });
    await call(PUT, 'alice', { code });
    const replayed = await call(PUT, 'alice', { code });

    __resetRateLimitStore();
    await call(POST, 'bob', { email: 'bob@metu.edu.tr' });
    const bobCode = lastSentCode();
    mockRows.get('bob')!.edu_verification_expires = new Date(Date.now() - 1000).toISOString();
    const expired = await call(PUT, 'bob', { code: bobCode });

    for (const result of [wrong, replayed, expired]) {
      expect(result).toEqual(noChallenge);
    }
    expect(noChallenge.status).toBe(400);
  });

  it('requires a signed-in, verified, non-anonymous account', async () => {
    expect((await call(POST, null, { email: EDU_EMAIL })).status).toBe(401);

    addUser('anon', { email: null });
    addUser('unverified', { emailVerified: false });
    expect((await call(POST, 'anon', { email: EDU_EMAIL })).status).toBe(403);
    expect((await call(POST, 'unverified', { email: EDU_EMAIL })).status).toBe(403);
    expect(mockSentEmails).toHaveLength(0);
    expect(mockRows.get('unverified')!.edu_otp_hash).toBeUndefined();
  });

  it('rate-limits code requests per user and per target email', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await call(POST, 'alice', { email: EDU_EMAIL })).status).toBe(200);
    }
    expect((await call(POST, 'alice', { email: EDU_EMAIL })).status).toBe(429);

    const victim = 'victim@itu.edu.tr';
    for (let i = 0; i < 5; i += 1) {
      addUser(`u${i}`);
      expect((await call(POST, `u${i}`, { email: victim })).status).toBe(200);
    }
    addUser('u5');
    expect((await call(POST, 'u5', { email: victim })).status).toBe(429);
  });

  it('rejects non edu.tr addresses without sending anything', async () => {
    expect((await call(POST, 'alice', { email: 'someone@gmail.com' })).status).toBe(400);
    expect(mockSentEmails).toHaveLength(0);
  });
});
