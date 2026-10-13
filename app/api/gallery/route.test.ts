/**
 * @jest-environment node
 */
import { getAuthenticatedUserFromRequest } from '@/lib/appwrite/server';
import { GALLERY_CONSENT_VERSION, buildGalleryConsent } from '@/lib/gallery-consent';
import { PROMPT_INJECTION_CORPUS } from '@/__tests__/fixtures/prompt-injection-corpus';
import { InMemoryDeletionStore } from '@/lib/privacy/__testing__/fake-privacy-port';
import { createDeletionRequest } from '@/lib/privacy/deletion';
import { resetSubjectGuardCache } from '@/lib/privacy/subject-guard';

const mockCreateFile = jest.fn();
const mockDeleteFile = jest.fn();
const mockCreateRow = jest.fn();
const mockGetRow = jest.fn();
const mockUpdateRow = jest.fn();
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
  APPWRITE_TABLE_GALLERY_ID: 'gallery_submissions',
  getAuthenticatedUserFromRequest: jest.fn(),
  getAdminStorage: () => ({ createFile: mockCreateFile, deleteFile: mockDeleteFile }),
  getAdminTables: () => ({
    createRow: mockCreateRow,
    getRow: mockGetRow,
    updateRow: mockUpdateRow,
    listRows: mockListRows,
  }),
}));

const mockDeletionStore = new InMemoryDeletionStore();
jest.mock('@/lib/privacy/deletion-store', () => ({
  createAppwriteDeletionStore: () => mockDeletionStore,
}));

jest.mock('@/lib/appwrite/resource-bootstrap', () => ({
  ensureCoreAppwriteResources: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: jest.fn(),
}));

const mockedGetUser = jest.mocked(getAuthenticatedUserFromRequest);

// Smallest valid PNG header + padding so magic-byte validation passes.
const PNG_BASE64 = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]).toString('base64');

const OWNER = { id: 'user-a', email: 'a@example.com', name: 'A', emailVerified: true };
const OTHER_USER = { id: 'user-b', email: 'b@example.com', name: 'B', emailVerified: true };
const GUEST = { id: 'guest-1', email: null, name: null };

function createRequest(options: { body?: unknown; search?: Record<string, string>; rawBody?: () => Promise<unknown> }) {
  return {
    headers: { get: () => null },
    json: options.rawBody ?? jest.fn().mockResolvedValue(options.body),
    nextUrl: { searchParams: new URLSearchParams(options.search ?? {}) },
  } as never;
}

function publishBody(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Riverside Library',
    juryQuote: 'Clear parti, weak section.',
    galleryType: 'HALL_OF_FAME',
    imageBase64: PNG_BASE64,
    mimeType: 'image/png',
    consent: buildGalleryConsent('HALL_OF_FAME'),
    ...overrides,
  };
}

function moderationResponse(content: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
  };
}

const SAFE_VERDICT = JSON.stringify({ approved: true, reason: 'ok', category: 'SAFE' });

async function loadRoute() {
  return import('@/app/api/gallery/route');
}

function createdRowStatus(): string {
  const call = mockCreateRow.mock.calls[0]?.[0] as { data: { status: string } } | undefined;
  if (!call) throw new Error('createRow was not called');
  return call.data.status;
}

describe('/api/gallery', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeletionStore.records.clear();
    resetSubjectGuardCache();
    process.env.AI_API_KEY = 'test-key';
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    mockedGetUser.mockResolvedValue(OWNER);
    mockCreateFile.mockResolvedValue({});
    mockDeleteFile.mockResolvedValue({});
    mockCreateRow.mockImplementation(async ({ rowId, data }: { rowId: string; data: Record<string, unknown> }) => ({
      $id: rowId,
      ...data,
    }));
    mockUpdateRow.mockImplementation(async ({ rowId, data }: { rowId: string; data: Record<string, unknown> }) => ({
      $id: rowId,
      user_id: OWNER.id,
      gallery_type: 'HALL_OF_FAME',
      title: 't',
      jury_quote: 'j',
      ...data,
    }));
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.AI_API_KEY;
  });

  describe('POST deletion tombstone', () => {
    it('refuses to publish for a subject with a deletion request and writes nothing', async () => {
      await mockDeletionStore.save(createDeletionRequest(OWNER.id, null, new Date()));
      const { POST } = await loadRoute();

      const response = await POST(createRequest({ body: publishBody() }));

      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toMatchObject({ code: 'ACCOUNT_DELETION_REQUESTED' });
      expect(mockCreateFile).not.toHaveBeenCalled();
      expect(mockCreateRow).not.toHaveBeenCalled();
    });

    it('fails closed when the deletion store is unavailable', async () => {
      jest.spyOn(mockDeletionStore, 'get').mockRejectedValueOnce(new Error('down'));
      const { POST } = await loadRoute();

      const response = await POST(createRequest({ body: publishBody() }));

      expect(response.status).toBe(503);
      expect(mockCreateFile).not.toHaveBeenCalled();
    });
  });

  describe('POST consent boundary', () => {
    it('writes nothing to storage or DB without explicit consent', async () => {
      const { POST } = await loadRoute();
      const response = await POST(createRequest({ body: publishBody({ consent: undefined }) }));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ code: 'GALLERY_CONSENT_REQUIRED' });
      expect(mockCreateFile).not.toHaveBeenCalled();
      expect(mockCreateRow).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      [{ granted: false, version: GALLERY_CONSENT_VERSION, scope: 'HALL_OF_FAME' }, 'GALLERY_CONSENT_REQUIRED', 400],
      [{ granted: 'true', version: GALLERY_CONSENT_VERSION, scope: 'HALL_OF_FAME' }, 'GALLERY_CONSENT_REQUIRED', 400],
      [{ granted: true, version: GALLERY_CONSENT_VERSION, scope: 'COMMUNITY' }, 'GALLERY_CONSENT_SCOPE_MISMATCH', 400],
      [{ granted: true, version: 'old', scope: 'HALL_OF_FAME' }, 'GALLERY_CONSENT_VERSION_MISMATCH', 409],
    ])('rejects malformed consent %j', async (consent, code, status) => {
      const { POST } = await loadRoute();
      const response = await POST(createRequest({ body: publishBody({ consent }) }));

      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({ code });
      expect(mockCreateFile).not.toHaveBeenCalled();
      expect(mockCreateRow).not.toHaveBeenCalled();
    });

    it('blocks guest publishing before any write', async () => {
      mockedGetUser.mockResolvedValue(GUEST);
      const { POST } = await loadRoute();
      const response = await POST(createRequest({ body: publishBody() }));

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ code: 'GUEST_PUBLISH_BLOCKED' });
      expect(mockCreateFile).not.toHaveBeenCalled();
      expect(mockCreateRow).not.toHaveBeenCalled();
    });

    it('rejects a non-image payload by magic bytes before storage', async () => {
      const { POST } = await loadRoute();
      const fakePng = Buffer.from('<script>alert(1)</script>').toString('base64');
      const response = await POST(createRequest({ body: publishBody({ imageBase64: fakePng }) }));

      expect(response.status).toBe(400);
      expect(mockCreateFile).not.toHaveBeenCalled();
    });

    it('records consent scope, version and server timestamp on the row', async () => {
      fetchMock.mockResolvedValue(moderationResponse(SAFE_VERDICT));
      const { POST } = await loadRoute();
      const before = Date.now();
      const response = await POST(createRequest({ body: publishBody() }));

      expect(response.status).toBe(200);
      const data = mockCreateRow.mock.calls[0][0].data as Record<string, string>;
      expect(data.consent_scope).toBe('HALL_OF_FAME');
      expect(data.consent_version).toBe(GALLERY_CONSENT_VERSION);
      expect(Date.parse(data.consented_at)).toBeGreaterThanOrEqual(before);
      expect(data.user_id).toBe(OWNER.id);
    });
  });

  describe('POST server-owned approval (fail pending)', () => {
    const clientApprovalAttempt = { autoApproved: true, status: 'approved', approved: true, moderationStatus: 'approved' };

    it('ignores client approval fields when the provider key is missing', async () => {
      delete process.env.AI_API_KEY;
      const { POST } = await loadRoute();
      const response = await POST(createRequest({ body: publishBody(clientApprovalAttempt) }));

      expect(response.status).toBe(200);
      expect(createdRowStatus()).toBe('pending');
      await expect(response.json()).resolves.toMatchObject({
        moderationPendingReview: true,
        code: 'GALLERY_PENDING_REVIEW',
      });
    });

    it.each([
      ['non-2xx', () => fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })],
      ['network error', () => fetchMock.mockRejectedValue(new Error('ECONNRESET'))],
      ['unparsable output', () => fetchMock.mockResolvedValue(moderationResponse('approved!!'))],
      ['string boolean', () => fetchMock.mockResolvedValue(moderationResponse('{"approved":"true","category":"SAFE"}'))],
      ['approved without SAFE', () => fetchMock.mockResolvedValue(moderationResponse('{"approved":true}'))],
      ['SENSITIVE approval', () => fetchMock.mockResolvedValue(
        moderationResponse('{"approved":true,"category":"SENSITIVE"}'),
      )],
      ['empty choices', () => fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })],
    ])('never approves on %s', async (_label, arrange) => {
      arrange();
      const { POST } = await loadRoute();
      const response = await POST(createRequest({ body: publishBody(clientApprovalAttempt) }));

      expect(response.status).toBe(200);
      expect(createdRowStatus()).toBe('pending');
    });

    it.each(['HALL_OF_FAME', 'WALL_OF_DEATH', 'COMMUNITY'] as const)(
      'approves %s only through the same server moderation policy',
      async (galleryType) => {
        fetchMock.mockResolvedValue(moderationResponse(SAFE_VERDICT));
        const { POST } = await loadRoute();
        const response = await POST(createRequest({
          body: publishBody({ galleryType, consent: buildGalleryConsent(galleryType) }),
        }));

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(createdRowStatus()).toBe('approved');
      },
    );

    it.each(PROMPT_INJECTION_CORPUS)('keeps injected text pending even with a SAFE verdict: %s', async (payload) => {
      fetchMock.mockResolvedValue(moderationResponse(SAFE_VERDICT));
      const { POST } = await loadRoute();
      await POST(createRequest({ body: publishBody({ juryQuote: payload }) }));
      await POST(createRequest({ body: publishBody({ title: payload.substring(0, 200) }) }));

      expect(mockCreateRow).toHaveBeenCalledTimes(2);
      for (const call of mockCreateRow.mock.calls) {
        expect((call[0] as { data: { status: string } }).data.status).toBe('pending');
      }
    });

    it('rejects without touching storage or the DB', async () => {
      fetchMock.mockResolvedValue(moderationResponse('{"approved":false,"reason":"nsfw","category":"REJECT"}'));
      const { POST } = await loadRoute();
      const response = await POST(createRequest({
        body: publishBody({ galleryType: 'COMMUNITY', consent: buildGalleryConsent('COMMUNITY') }),
      }));

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toMatchObject({ code: 'COMMUNITY_MODERATION_REJECTED' });
      expect(mockCreateFile).not.toHaveBeenCalled();
      expect(mockCreateRow).not.toHaveBeenCalled();
    });

    it('cleans up the uploaded file when the row write fails', async () => {
      fetchMock.mockResolvedValue(moderationResponse(SAFE_VERDICT));
      mockCreateRow.mockRejectedValueOnce(new Error('db down'));
      const { POST } = await loadRoute();
      const response = await POST(createRequest({ body: publishBody() }));

      expect(response.status).toBe(500);
      expect(mockCreateFile).toHaveBeenCalledTimes(1);
      const uploadedFileId = (mockCreateFile.mock.calls[0][0] as { fileId: string }).fileId;
      expect(mockDeleteFile).toHaveBeenCalledWith({ bucketId: 'gallery', fileId: uploadedFileId });
    });
  });

  describe('GET public feed', () => {
    it('queries approved rows only and drops anything unmoderated or revoked', async () => {
      mockListRows.mockResolvedValue({
        total: 4,
        rows: [
          { $id: 'ok', user_id: 'u', status: 'approved', gallery_type: 'HALL_OF_FAME', title: 't', jury_quote: 'j' },
          { $id: 'pending', user_id: 'u', status: 'pending', gallery_type: 'HALL_OF_FAME', title: 't', jury_quote: 'j' },
          { $id: 'archived', user_id: 'u', status: 'archived', gallery_type: 'HALL_OF_FAME', title: 't', jury_quote: 'j' },
          {
            $id: 'revoked',
            user_id: 'u',
            status: 'approved',
            revoked_at: '2026-10-01T00:00:00.000Z',
            gallery_type: 'HALL_OF_FAME',
            title: 't',
            jury_quote: 'j',
          },
        ],
      });
      const { GET } = await loadRoute();
      const response = await GET(createRequest({ search: { type: 'HALL_OF_FAME' } }));
      const payload = await response.json() as { items: Array<{ id: string }> };

      expect(payload.items.map((item) => item.id)).toEqual(['ok']);
      const queries = (mockListRows.mock.calls[0][0] as { queries: string[] }).queries;
      expect(queries.some((query) => query.includes('"status"') && query.includes('approved'))).toBe(true);
      expect(mockedGetUser).not.toHaveBeenCalled();
    });
  });

  describe('PATCH ownership and revocation', () => {
    const ownedRow = (status: string, extra: Record<string, unknown> = {}) => ({
      $id: 'sub-1',
      user_id: OWNER.id,
      status,
      gallery_type: 'HALL_OF_FAME',
      title: 't',
      jury_quote: 'j',
      ...extra,
    });

    it('does not let another user archive or reshare the owner submission', async () => {
      mockedGetUser.mockResolvedValue(OTHER_USER);
      mockGetRow.mockResolvedValue(ownedRow('approved'));
      const { PATCH } = await loadRoute();

      const archive = await PATCH(createRequest({ body: { submissionId: 'sub-1', action: 'ARCHIVE' } }));
      mockGetRow.mockResolvedValue(ownedRow('archived', { archived_from_status: 'approved' }));
      const reshare = await PATCH(createRequest({
        body: { submissionId: 'sub-1', action: 'RESHARE', consent: buildGalleryConsent('HALL_OF_FAME') },
      }));

      expect(archive.status).toBe(403);
      expect(reshare.status).toBe(403);
      expect(mockUpdateRow).not.toHaveBeenCalled();
    });

    it('lets the owner revoke an approved or pending submission and records revoked_at', async () => {
      const { PATCH } = await loadRoute();
      for (const status of ['approved', 'pending']) {
        mockUpdateRow.mockClear();
        mockGetRow.mockResolvedValue(ownedRow(status));
        const response = await PATCH(createRequest({ body: { submissionId: 'sub-1', action: 'ARCHIVE' } }));

        expect(response.status).toBe(200);
        const data = mockUpdateRow.mock.calls[0][0].data as Record<string, string>;
        expect(data.status).toBe('archived');
        expect(data.archived_from_status).toBe(status);
        expect(typeof data.revoked_at).toBe('string');
      }
    });

    it('requires fresh consent to reshare', async () => {
      mockGetRow.mockResolvedValue(ownedRow('archived', { archived_from_status: 'approved' }));
      const { PATCH } = await loadRoute();
      const response = await PATCH(createRequest({ body: { submissionId: 'sub-1', action: 'RESHARE' } }));

      expect(response.status).toBe(400);
      expect(mockUpdateRow).not.toHaveBeenCalled();
    });

    it.each([
      ['approved', 'approved'],
      ['pending', 'pending'],
      [undefined, 'pending'],
    ])('reshare from archived_from_status=%s restores %s (never upgrades)', async (fromStatus, expected) => {
      mockGetRow.mockResolvedValue(ownedRow('archived', fromStatus ? { archived_from_status: fromStatus } : {}));
      const { PATCH } = await loadRoute();
      const response = await PATCH(createRequest({
        body: { submissionId: 'sub-1', action: 'RESHARE', consent: buildGalleryConsent('HALL_OF_FAME') },
      }));

      expect(response.status).toBe(200);
      const data = mockUpdateRow.mock.calls[0][0].data as Record<string, unknown>;
      expect(data.status).toBe(expected);
      expect(data.revoked_at).toBeNull();
      expect(data.consent_version).toBe(GALLERY_CONSENT_VERSION);
    });

    it('cannot archive a rejected submission or reshare a non-archived one', async () => {
      const { PATCH } = await loadRoute();
      mockGetRow.mockResolvedValue(ownedRow('rejected'));
      const archive = await PATCH(createRequest({ body: { submissionId: 'sub-1', action: 'ARCHIVE' } }));
      mockGetRow.mockResolvedValue(ownedRow('pending'));
      const reshare = await PATCH(createRequest({
        body: { submissionId: 'sub-1', action: 'RESHARE', consent: buildGalleryConsent('HALL_OF_FAME') },
      }));

      expect(archive.status).toBe(409);
      expect(reshare.status).toBe(409);
      expect(mockUpdateRow).not.toHaveBeenCalled();
    });
  });
});
