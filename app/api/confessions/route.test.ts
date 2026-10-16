/**
 * @jest-environment node
 */
import { PROMPT_INJECTION_CORPUS } from '@/__tests__/fixtures/prompt-injection-corpus';

const mockCreateFile = jest.fn();
const mockDeleteFile = jest.fn();
const mockCreateRow = jest.fn();
const mockListRows = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_BUCKET_GALLERY_ID: 'gallery',
  APPWRITE_DATABASE_ID: 'db',
  APPWRITE_SERVER_ENDPOINT: 'https://appwrite.test/v1',
  APPWRITE_SERVER_PROJECT_ID: 'project',
  APPWRITE_TABLE_CONFESSIONS_ID: 'confessions',
  getAdminStorage: () => ({ createFile: mockCreateFile, deleteFile: mockDeleteFile }),
  getAdminTables: () => ({ createRow: mockCreateRow, listRows: mockListRows }),
}));

jest.mock('@/lib/appwrite/resource-bootstrap', () => ({
  ensureCoreAppwriteResources: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: 0 }),
}));

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: jest.fn(),
}));

// Resizing is irrelevant here; keep the buffer as-is.
jest.mock('sharp', () => {
  throw new Error('sharp unavailable in tests');
});

function createRequest(body: unknown) {
  return {
    headers: { get: () => null },
    json: jest.fn().mockResolvedValue(body),
  } as never;
}

function moderationResponse(content: string) {
  return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
}

const VALID_TEXT = 'Slept two hours before the final jury and the model still collapsed.';
const SAFE_VERDICT = '{"approved":true,"category":"SAFE","reason":"ok"}';

function createdStatus(): string {
  return (mockCreateRow.mock.calls[0][0] as { data: { status: string } }).data.status;
}

async function loadRoute() {
  return import('@/app/api/confessions/route');
}

describe('POST /api/confessions moderation boundary', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_MODERATION_MODE = 'on';
    global.fetch = fetchMock as unknown as typeof fetch;
    mockListRows.mockResolvedValue({ total: 0, rows: [] });
    mockCreateFile.mockResolvedValue({});
    mockCreateRow.mockImplementation(async ({ rowId, data }: { rowId: string; data: Record<string, unknown> }) => ({
      $id: rowId,
      $createdAt: '2026-10-13T00:00:00.000Z',
      ...data,
    }));
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODERATION_MODE;
  });

  it('with AI moderation offline (default) makes no provider call and stores pending for manual review', async () => {
    delete process.env.AI_MODERATION_MODE;
    fetchMock.mockResolvedValue(moderationResponse(SAFE_VERDICT));
    const { POST } = await loadRoute();
    const response = await POST(createRequest({
      text: VALID_TEXT,
      anonKey: 'anon-key-123',
      imageBase64: Buffer.from('jpeg-bytes').toString('base64'),
      imageMimeType: 'image/jpeg',
    }));

    await expect(response.json()).resolves.toMatchObject({ pending: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockCreateFile).toHaveBeenCalledTimes(1);
    expect(mockCreateRow.mock.calls[0][0].data).toMatchObject({ status: 'pending', moderation_reason: 'manual_review' });
  });

  it.each([
    ['missing key', () => { delete process.env.AI_API_KEY; }],
    ['non-2xx', () => fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })],
    ['network error', () => fetchMock.mockRejectedValue(new Error('timeout'))],
    ['unparsable output', () => fetchMock.mockResolvedValue(moderationResponse('sure, approved'))],
    ['approval without SAFE category', () => fetchMock.mockResolvedValue(moderationResponse('{"approved":true}'))],
  ])('stays pending on %s', async (_label, arrange) => {
    arrange();
    const { POST } = await loadRoute();
    const response = await POST(createRequest({ text: VALID_TEXT, anonKey: 'anon-key-123' }));

    expect(response.status).toBe(200);
    expect(createdStatus()).toBe('pending');
  });

  it('approves only a strict SAFE verdict', async () => {
    fetchMock.mockResolvedValue(moderationResponse(SAFE_VERDICT));
    const { POST } = await loadRoute();
    await POST(createRequest({ text: VALID_TEXT, anonKey: 'anon-key-123' }));

    expect(createdStatus()).toBe('approved');
  });

  it.each(PROMPT_INJECTION_CORPUS.filter((text) => text.length >= 10))(
    'keeps injection attempts pending: %s',
    async (text) => {
      fetchMock.mockResolvedValue(moderationResponse(SAFE_VERDICT));
      const { POST } = await loadRoute();
      await POST(createRequest({ text, anonKey: 'anon-key-123' }));

      expect(createdStatus()).toBe('pending');
    },
  );

  it('does not upload the image of a rejected confession', async () => {
    fetchMock.mockResolvedValue(moderationResponse('{"approved":false,"category":"REJECT","reason":"doxxing"}'));
    const { POST } = await loadRoute();
    await POST(createRequest({
      text: VALID_TEXT,
      anonKey: 'anon-key-123',
      imageBase64: Buffer.from('jpeg-bytes').toString('base64'),
      imageMimeType: 'image/jpeg',
    }));

    expect(mockCreateFile).not.toHaveBeenCalled();
    expect(createdStatus()).toBe('rejected');
  });
});
