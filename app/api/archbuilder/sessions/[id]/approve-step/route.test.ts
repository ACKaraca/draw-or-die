import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import { APPWRITE_DATABASE_ID, APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID, APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID, getAuthenticatedUserFromRequest } from '@/lib/appwrite/server';
import { getArchBuilderAccessForUser, isArchBuilderServerUnavailable, localizedArchBuilderMessage } from '@/lib/archbuilder/api-utils';
import { getArchBuilderSessionForUser, getArchBuilderStepOutput } from '@/lib/archbuilder/session-service';
import { getRequestLanguage } from '@/lib/server-i18n';

const mockUpdateRow = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('@/lib/appwrite/resource-bootstrap', () => ({
  ensureCoreAppwriteResources: jest.fn(),
}));

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'draw_or_die',
  APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID: 'archbuilder_sessions',
  APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID: 'archbuilder_step_outputs',
  getAuthenticatedUserFromRequest: jest.fn(),
  getAdminTables: () => ({
    updateRow: (...args: unknown[]) => mockUpdateRow(...args),
  }),
}));

jest.mock('@/lib/archbuilder/session-service', () => ({
  getArchBuilderSessionForUser: jest.fn(),
  getArchBuilderStepOutput: jest.fn(),
}));

jest.mock('@/lib/archbuilder/api-utils', () => ({
  isArchBuilderServerUnavailable: jest.fn(),
  parseSessionIdFromArchBuilderPath: (pathname: string) => {
    const match = /\/sessions\/([^/]+)\//.exec(pathname);
    return match?.[1] ?? null;
  },
  safeJsonParse: (raw: string, fallback: unknown) => {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  localizedArchBuilderMessage: jest.fn((_language: string, trText: string, enText: string) => trText || enText),
  getArchBuilderAccessForUser: jest.fn(),
}));

jest.mock('@/lib/server-i18n', () => ({
  getRequestLanguage: jest.fn(),
}));

const mockedEnsureCoreAppwriteResources = jest.mocked(ensureCoreAppwriteResources);
const mockedGetAuthenticatedUserFromRequest = jest.mocked(getAuthenticatedUserFromRequest);
const mockedGetArchBuilderSessionForUser = jest.mocked(getArchBuilderSessionForUser);
const mockedGetArchBuilderStepOutput = jest.mocked(getArchBuilderStepOutput);
const mockedIsArchBuilderServerUnavailable = jest.mocked(isArchBuilderServerUnavailable);
const mockedLocalizedArchBuilderMessage = jest.mocked(localizedArchBuilderMessage);
const mockedGetArchBuilderAccessForUser = jest.mocked(getArchBuilderAccessForUser);
const mockedGetRequestLanguage = jest.mocked(getRequestLanguage);

function createRequest(body: unknown) {
  return {
    nextUrl: {
      pathname: '/api/archbuilder/sessions/session-1/approve-step',
    },
    json: jest.fn().mockResolvedValue(body),
  };
}

async function loadRoute() {
  const mod = await import('@/app/api/archbuilder/sessions/[id]/approve-step/route');
  return mod.POST;
}

describe('POST /api/archbuilder/sessions/[id]/approve-step', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedIsArchBuilderServerUnavailable.mockReturnValue(false);
    mockedGetRequestLanguage.mockReturnValue('tr');
    mockedLocalizedArchBuilderMessage.mockImplementation((_language, trText, enText) => trText || enText);

    mockedEnsureCoreAppwriteResources.mockResolvedValue(undefined);
    mockedGetAuthenticatedUserFromRequest.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
    });
    mockedGetArchBuilderAccessForUser.mockResolvedValue('enabled');
    mockedGetArchBuilderSessionForUser.mockResolvedValue({
      project: {
        $id: 'project-1',
      } as never,
      session: {
        $id: 'session-1',
        current_step: 'site',
        approvals_json: '[]',
      } as never,
    });
    mockedGetArchBuilderStepOutput.mockResolvedValue({
      $id: 'step-output-1',
      output_json: JSON.stringify({ ok: true }),
      is_approved: false,
    } as never);
    mockUpdateRow.mockResolvedValue(undefined);
  });

  it('does not send approved_at when approval is false', async () => {
    const POST = await loadRoute();

    const response = await POST(createRequest({ stepKey: 'site', approved: false }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      approved: false,
      step: 'site',
      currentStep: 'site',
    });

    expect(mockUpdateRow).toHaveBeenCalledTimes(1);
    const firstUpdate = mockUpdateRow.mock.calls[0][0];
    expect(firstUpdate).toEqual(
      expect.objectContaining({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
        rowId: 'step-output-1',
      }),
    );
    expect(firstUpdate.data).toEqual(
      expect.objectContaining({
        is_approved: false,
      }),
    );
    expect(Object.prototype.hasOwnProperty.call(firstUpdate.data, 'approved_at')).toBe(false);
  });

  it('writes approved_at and advances to next planning step', async () => {
    const POST = await loadRoute();

    const response = await POST(createRequest({ stepKey: 'site', approved: true }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        approved: true,
        step: 'site',
        currentStep: 'constraints',
        status: 'active',
        approvals: ['site'],
      }),
    );

    expect(mockUpdateRow).toHaveBeenCalledTimes(2);

    const stepUpdate = mockUpdateRow.mock.calls[0][0];
    expect(stepUpdate).toEqual(
      expect.objectContaining({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
        rowId: 'step-output-1',
      }),
    );
    expect(stepUpdate.data).toEqual(
      expect.objectContaining({
        is_approved: true,
      }),
    );
    expect(typeof stepUpdate.data.approved_at).toBe('string');
    expect(stepUpdate.data.approved_at.length).toBeGreaterThan(5);

    const sessionUpdate = mockUpdateRow.mock.calls[1][0];
    expect(sessionUpdate).toEqual(
      expect.objectContaining({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
        rowId: 'session-1',
      }),
    );
    expect(sessionUpdate.data).toEqual(
      expect.objectContaining({
        current_step: 'constraints',
        status: 'active',
      }),
    );
  });

  it('returns 403 when user is not allowlisted', async () => {
    mockedGetArchBuilderAccessForUser.mockResolvedValueOnce('not-allowlisted');
    const POST = await loadRoute();

    const response = await POST(createRequest({ stepKey: 'site', approved: true }) as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: 'ARCHBUILDER_NOT_ALLOWLISTED',
      }),
    );
    expect(mockUpdateRow).not.toHaveBeenCalled();
  });
});
