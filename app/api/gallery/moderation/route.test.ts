/**
 * @jest-environment node
 */
import { getAuthenticatedUserFromRequest } from '@/lib/appwrite/server';
import { logServerInfo } from '@/lib/logger';
import { cleanupGalleryUpload } from '@/lib/gallery-storage-cleanup';

const mockDeleteFile = jest.fn();
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
  APPWRITE_TABLE_GALLERY_ID: 'gallery_submissions',
  getAuthenticatedUserFromRequest: jest.fn(),
  isVerifiedAdmin: (user: { email: string | null; emailVerified?: boolean }) =>
    user.emailVerified === true && user.email === 'admin@example.com',
  getAdminStorage: () => ({ deleteFile: mockDeleteFile }),
  getAdminTables: () => ({ getRow: mockGetRow, updateRow: mockUpdateRow, listRows: mockListRows }),
}));

jest.mock('@/lib/appwrite/resource-bootstrap', () => ({
  ensureCoreAppwriteResources: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({
  logServerError: jest.fn(),
  logServerInfo: jest.fn(),
}));

const mockedGetUser = jest.mocked(getAuthenticatedUserFromRequest);
const mockedLogInfo = jest.mocked(logServerInfo);

const ADMIN = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', emailVerified: true };
const UNVERIFIED_ADMIN = { ...ADMIN, emailVerified: false };
const USER = { id: 'user-a', email: 'a@example.com', name: 'A', emailVerified: true };

function createRequest(body?: unknown) {
  return {
    headers: { get: () => null },
    json: jest.fn().mockResolvedValue(body),
    nextUrl: { searchParams: new URLSearchParams() },
  } as never;
}

const pendingRow = {
  $id: 'sub-1',
  user_id: 'user-a',
  status: 'pending',
  storage_path: 'file-1',
  gallery_type: 'COMMUNITY',
  title: 't',
  jury_quote: 'j',
};

async function loadRoute() {
  return import('@/app/api/gallery/moderation/route');
}

describe('/api/gallery/moderation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRow.mockResolvedValue(pendingRow);
    mockUpdateRow.mockImplementation(async ({ rowId, data }: { rowId: string; data: Record<string, unknown> }) => ({
      ...pendingRow,
      $id: rowId,
      ...data,
    }));
    mockDeleteFile.mockResolvedValue({});
  });

  it.each([
    ['regular user', USER],
    ['admin with unverified email', UNVERIFIED_ADMIN],
  ])('forbids and audits a %s', async (_label, user) => {
    mockedGetUser.mockResolvedValue(user);
    const { POST, GET } = await loadRoute();

    const decision = await POST(createRequest({ submissionId: 'sub-1', action: 'APPROVE' }));
    const queue = await GET(createRequest());

    expect(decision.status).toBe(403);
    expect(queue.status).toBe(403);
    expect(mockUpdateRow).not.toHaveBeenCalled();
    expect(mockListRows).not.toHaveBeenCalled();
    expect(mockedLogInfo).toHaveBeenCalledWith(
      'api.gallery.moderation.audit',
      expect.objectContaining({ actorId: user.id, result: 'forbidden' }),
    );
  });

  it('lets a verified admin approve a pending submission with an audit record', async () => {
    mockedGetUser.mockResolvedValue(ADMIN);
    const { POST } = await loadRoute();
    const response = await POST(createRequest({ submissionId: 'sub-1', action: 'APPROVE' }));

    expect(response.status).toBe(200);
    expect(mockUpdateRow.mock.calls[0][0].data).toMatchObject({ status: 'approved', moderated_by: ADMIN.id });
    expect(mockedLogInfo).toHaveBeenCalledWith(
      'api.gallery.moderation.audit',
      expect.objectContaining({ actorId: ADMIN.id, action: 'APPROVE', fromStatus: 'pending', toStatus: 'approved' }),
    );
  });

  it('cannot re-publish a revoked (archived) submission', async () => {
    mockedGetUser.mockResolvedValue(ADMIN);
    mockGetRow.mockResolvedValue({ ...pendingRow, status: 'archived' });
    const { POST } = await loadRoute();
    const response = await POST(createRequest({ submissionId: 'sub-1', action: 'APPROVE' }));

    expect(response.status).toBe(409);
    expect(mockUpdateRow).not.toHaveBeenCalled();
  });

  it('keeps the rejected row as evidence and removes its image', async () => {
    mockedGetUser.mockResolvedValue(ADMIN);
    const { POST } = await loadRoute();
    const response = await POST(createRequest({ submissionId: 'sub-1', action: 'REJECT', note: 'spam' }));

    expect(response.status).toBe(200);
    expect(mockUpdateRow.mock.calls[0][0].data).toMatchObject({ status: 'rejected', moderation_reason: 'spam' });
    expect(mockDeleteFile).toHaveBeenCalledWith({ bucketId: 'gallery', fileId: 'file-1' });
  });
});

describe('cleanupGalleryUpload', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is idempotent: an already-deleted file counts as cleaned and is logged', async () => {
    mockDeleteFile.mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error('not found'), { code: 404 }));

    await expect(cleanupGalleryUpload('file-1', 'orphan', 'test')).resolves.toBe('deleted');
    await expect(cleanupGalleryUpload('file-1', 'orphan', 'test')).resolves.toBe('already_gone');
    expect(mockedLogInfo).toHaveBeenCalledWith('test.upload-cleanup', expect.objectContaining({ result: 'already_gone' }));
  });

  it('skips empty ids and reports real failures without throwing', async () => {
    mockDeleteFile.mockRejectedValueOnce(Object.assign(new Error('boom'), { code: 500 }));

    await expect(cleanupGalleryUpload('', 'orphan', 'test')).resolves.toBe('skipped');
    await expect(cleanupGalleryUpload('file-2', 'orphan', 'test')).resolves.toBe('failed');
  });
});
