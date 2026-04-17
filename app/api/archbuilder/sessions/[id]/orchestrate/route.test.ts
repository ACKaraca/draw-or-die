import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
  APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';
import {
  getArchBuilderAccessForUser,
  isArchBuilderServerUnavailable,
  localizedArchBuilderMessage,
} from '@/lib/archbuilder/api-utils';
import {
  getArchBuilderSessionForUser,
  getArchBuilderStepOutput,
} from '@/lib/archbuilder/session-service';
import { buildPlanningStepOutput } from '@/lib/archbuilder/engine';
import { getRequestLanguage } from '@/lib/server-i18n';

const mockCreateRow = jest.fn();
const mockUpdateRow = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock('node-appwrite', () => ({
  ID: {
    unique: () => 'mock-id',
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
    createRow: (...args: unknown[]) => mockCreateRow(...args),
    updateRow: (...args: unknown[]) => mockUpdateRow(...args),
  }),
}));

jest.mock('@/lib/archbuilder/session-service', () => ({
  getArchBuilderSessionForUser: jest.fn(),
  getArchBuilderStepOutput: jest.fn(),
}));

jest.mock('@/lib/archbuilder/engine', () => ({
  buildPlanningStepOutput: jest.fn(),
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
const mockedBuildPlanningStepOutput = jest.mocked(buildPlanningStepOutput);
const mockedIsArchBuilderServerUnavailable = jest.mocked(isArchBuilderServerUnavailable);
const mockedLocalizedArchBuilderMessage = jest.mocked(localizedArchBuilderMessage);
const mockedGetArchBuilderAccessForUser = jest.mocked(getArchBuilderAccessForUser);
const mockedGetRequestLanguage = jest.mocked(getRequestLanguage);

function createRequest(body: unknown) {
  return {
    nextUrl: {
      pathname: '/api/archbuilder/sessions/session-1/orchestrate',
    },
    json: jest.fn().mockResolvedValue(body),
  };
}

async function loadRoute() {
  const mod = await import('@/app/api/archbuilder/sessions/[id]/orchestrate/route');
  return mod.POST;
}

describe('POST /api/archbuilder/sessions/[id]/orchestrate', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    delete process.env.ARCHBUILDER_LOW_CONFIDENCE_THRESHOLD;

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
        intent_json: JSON.stringify({
          title: 'Test Project',
          projectType: 'Residential',
          location: 'Antalya',
          targetAreaM2: 2000,
          constraints: [],
          priorities: ['Daylight'],
        }),
      } as never,
      session: {
        $id: 'session-1',
        current_step: 'stacking',
        confidence_score: 66,
      } as never,
    });

    mockCreateRow.mockResolvedValue({
      $id: 'step-output-created',
      output_json: JSON.stringify({ ok: true }),
      clarifications_json: '[]',
      confidence_score: 88,
    });
    mockUpdateRow.mockResolvedValue(undefined);
  });

  it('activates clarification loop only for low confidence outputs', async () => {
    mockedGetArchBuilderStepOutput.mockResolvedValueOnce({
      $id: 'step-output-1',
      output_json: JSON.stringify({ phase: 'stacking' }),
      clarifications_json: JSON.stringify(['Confirm vertical circulation assumptions.']),
      confidence_score: 66,
      is_approved: false,
    } as never);

    const POST = await loadRoute();
    const response = await POST(createRequest({}) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        step: 'stacking',
        requiresApproval: true,
        requiresClarification: true,
        clarificationLoop: 'active',
        clarifications: ['Confirm vertical circulation assumptions.'],
        confidenceScore: 66,
      }),
    );
  });

  it('resolves clarification loop when answers are provided', async () => {
    mockedGetArchBuilderStepOutput.mockResolvedValueOnce({
      $id: 'step-output-1',
      output_json: JSON.stringify({ phase: 'stacking' }),
      clarifications_json: JSON.stringify(['Confirm vertical circulation assumptions.']),
      confidence_score: 66,
      is_approved: false,
    } as never);

    const POST = await loadRoute();
    const response = await POST(
      createRequest({
        clarificationAnswers: ['Vertical circulation core is locked with two stairs.'],
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        requiresClarification: false,
        clarificationLoop: 'resolved',
        clarificationAnswersAccepted: 1,
        confidenceScore: 71,
      }),
    );

    expect(mockUpdateRow).toHaveBeenCalledTimes(2);
    expect(mockUpdateRow.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
        rowId: 'step-output-1',
        data: expect.objectContaining({
          clarifications_json: '[]',
          confidence_score: 71,
        }),
      }),
    );
    expect(mockUpdateRow.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        databaseId: APPWRITE_DATABASE_ID,
        tableId: APPWRITE_TABLE_ARCHBUILDER_SESSIONS_ID,
        rowId: 'session-1',
        data: expect.objectContaining({
          confidence_score: 71,
        }),
      }),
    );
  });

  it('omits clarifications for high-confidence computed output', async () => {
    mockedGetArchBuilderStepOutput.mockResolvedValueOnce(null as never);
    mockedBuildPlanningStepOutput.mockReturnValueOnce({
      output: { phase: 'stacking' },
      confidenceScore: 88,
      assumptions: ['A1'],
      clarifications: ['Should not be emitted at high confidence'],
    });

    const POST = await loadRoute();
    const response = await POST(createRequest({}) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        requiresApproval: true,
        requiresClarification: false,
        clarificationLoop: 'none',
        clarifications: [],
        confidenceScore: 88,
      }),
    );

    expect(mockCreateRow).toHaveBeenCalledTimes(1);
    expect(mockCreateRow.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        tableId: APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
        data: expect.objectContaining({
          clarifications_json: '[]',
        }),
      }),
    );
  });
});
