import { ensureCoreAppwriteResources } from '@/lib/appwrite/resource-bootstrap';
import {
  APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID,
  APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID,
  APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID,
  getAuthenticatedUserFromRequest,
} from '@/lib/appwrite/server';
import {
  getArchBuilderAccessForUser,
  isArchBuilderServerUnavailable,
  localizedArchBuilderMessage,
} from '@/lib/archbuilder/api-utils';
import {
  buildDrawingFromProgram,
  buildDxfFromDrawing,
  buildSvgPreviewDataUrl,
} from '@/lib/archbuilder/engine';
import {
  getArchBuilderSessionForUser,
  getArchBuilderStepOutput,
} from '@/lib/archbuilder/session-service';
import { getRequestLanguage } from '@/lib/server-i18n';

const mockCreateRow = jest.fn();
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

jest.mock('node-appwrite', () => ({
  ID: {
    unique: () => 'mock-id',
  },
  Query: {
    equal: (...args: unknown[]) => ({ method: 'equal', args }),
    limit: (...args: unknown[]) => ({ method: 'limit', args }),
  },
}));

jest.mock('@/lib/appwrite/resource-bootstrap', () => ({
  ensureCoreAppwriteResources: jest.fn(),
}));

jest.mock('@/lib/appwrite/server', () => ({
  APPWRITE_DATABASE_ID: 'draw_or_die',
  APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID: 'archbuilder_step_outputs',
  APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID: 'archbuilder_exports',
  APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID: 'archbuilder_furniture_placements',
  getAuthenticatedUserFromRequest: jest.fn(),
  getAdminTables: () => ({
    createRow: (...args: unknown[]) => mockCreateRow(...args),
    updateRow: (...args: unknown[]) => mockUpdateRow(...args),
    listRows: (...args: unknown[]) => mockListRows(...args),
  }),
}));

jest.mock('@/lib/archbuilder/session-service', () => ({
  getArchBuilderSessionForUser: jest.fn(),
  getArchBuilderStepOutput: jest.fn(),
}));

jest.mock('@/lib/archbuilder/engine', () => ({
  buildDrawingFromProgram: jest.fn(),
  buildDxfFromDrawing: jest.fn(),
  buildSvgPreviewDataUrl: jest.fn(),
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
const mockedBuildDrawingFromProgram = jest.mocked(buildDrawingFromProgram);
const mockedBuildDxfFromDrawing = jest.mocked(buildDxfFromDrawing);
const mockedBuildSvgPreviewDataUrl = jest.mocked(buildSvgPreviewDataUrl);
const mockedIsArchBuilderServerUnavailable = jest.mocked(isArchBuilderServerUnavailable);
const mockedLocalizedArchBuilderMessage = jest.mocked(localizedArchBuilderMessage);
const mockedGetArchBuilderAccessForUser = jest.mocked(getArchBuilderAccessForUser);
const mockedGetRequestLanguage = jest.mocked(getRequestLanguage);

function createRequest(body: unknown) {
  return {
    nextUrl: {
      pathname: '/api/archbuilder/sessions/session-1/generate-drawing',
    },
    json: jest.fn().mockResolvedValue(body),
  };
}

async function loadRoute() {
  const mod = await import('@/app/api/archbuilder/sessions/[id]/generate-drawing/route');
  return mod.POST;
}

describe('POST /api/archbuilder/sessions/[id]/generate-drawing', () => {
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
      } as never,
    });

    mockedGetArchBuilderStepOutput.mockImplementation(async (params) => {
      if (params.stepKey === 'program') {
        return {
          $id: 'program-step',
          is_approved: true,
          output_json: JSON.stringify({
            departments: [
              {
                id: 'dept-core',
                name: 'Core',
                targetAreaM2: 1000,
                minAreaM2: 900,
                maxAreaM2: 1200,
                priority: 'core',
              },
            ],
            spaces: [
              {
                id: 'space-core',
                name: 'Core Space',
                departmentId: 'dept-core',
                areaM2: 900,
                floor: 0,
              },
            ],
          }),
        } as never;
      }

      return null as never;
    });

    mockedBuildDrawingFromProgram.mockReturnValue({
      units: 'm',
      rooms: [
        {
          spaceId: 'space-core',
          floor: 0,
          polygon: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
          ],
        },
      ],
    });
    mockedBuildDxfFromDrawing.mockReturnValue('DXF_CONTENT');
    mockedBuildSvgPreviewDataUrl.mockReturnValue('SVG_DATA_URL');

    mockListRows.mockResolvedValue({
      rows: [
        {
          placement_json: JSON.stringify({
            assetKey: 'table.standard.rect.01',
            category: 'table',
            roomId: 'space-core',
            x: 4,
            y: 4,
            width: 1.6,
            depth: 0.8,
            rotationDeg: 0,
            collisionScore: 0,
          }),
        },
      ],
    });

    mockCreateRow.mockImplementation(async ({ tableId, data }: { tableId: string; data: Record<string, unknown> }) => {
      if (tableId === APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID) {
        return {
          $id: 'drawing-step',
          output_json: JSON.stringify(data.output_json ?? {}),
        };
      }

      return {
        $id: `export-${String(data.export_format).toLowerCase()}`,
        export_format: data.export_format,
        status: data.status,
        artifact_url: data.artifact_url,
        preview_url: data.preview_url,
        include_furniture: data.include_furniture,
        $createdAt: '2026-04-16T00:00:00.000Z',
      };
    });
  });

  it('includes furniture payload in exports when includeFurniture=true', async () => {
    const POST = await loadRoute();

    const response = await POST(
      createRequest({
        formats: ['DXF', 'PNG'],
        includeFurniture: true,
      }) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        exports: expect.arrayContaining([
          expect.objectContaining({
            format: 'DXF',
            includeFurniture: true,
          }),
          expect.objectContaining({
            format: 'PNG',
            includeFurniture: true,
          }),
        ]),
      }),
    );

    expect(mockListRows).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID,
      }),
    );

    const exportCreateCalls = mockCreateRow.mock.calls
      .map((call) => call[0])
      .filter((call) => call.tableId === APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID);

    expect(exportCreateCalls).toHaveLength(2);
    for (const call of exportCreateCalls) {
      expect(call.data.include_furniture).toBe(true);
      expect(call.data.payload_json).toContain('"furniture"');
    }

    expect(mockedBuildDxfFromDrawing).toHaveBeenCalledWith(
      expect.any(Object),
      expect.arrayContaining([
        expect.objectContaining({ assetKey: 'table.standard.rect.01' }),
      ]),
    );
    expect(mockedBuildSvgPreviewDataUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.arrayContaining([
        expect.objectContaining({ assetKey: 'table.standard.rect.01' }),
      ]),
    );
    expect(mockUpdateRow).not.toHaveBeenCalled();
  });
});
