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
  buildDxfFromDrawing,
  buildSvgPreviewDataUrl,
  placeFurnitureForDrawing,
} from '@/lib/archbuilder/engine';
import {
  getArchBuilderSessionForUser,
  getArchBuilderStepOutput,
} from '@/lib/archbuilder/session-service';
import { getRequestLanguage } from '@/lib/server-i18n';

const mockCreateRow = jest.fn();
const mockUpdateRow = jest.fn();
const mockDeleteRow = jest.fn();
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
  APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID: 'archbuilder_furniture_placements',
  APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID: 'archbuilder_step_outputs',
  APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID: 'archbuilder_exports',
  getAuthenticatedUserFromRequest: jest.fn(),
  getAdminTables: () => ({
    createRow: (...args: unknown[]) => mockCreateRow(...args),
    updateRow: (...args: unknown[]) => mockUpdateRow(...args),
    deleteRow: (...args: unknown[]) => mockDeleteRow(...args),
    listRows: (...args: unknown[]) => mockListRows(...args),
  }),
}));

jest.mock('@/lib/archbuilder/session-service', () => ({
  getArchBuilderSessionForUser: jest.fn(),
  getArchBuilderStepOutput: jest.fn(),
}));

jest.mock('@/lib/archbuilder/engine', () => ({
  placeFurnitureForDrawing: jest.fn(),
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
const mockedPlaceFurnitureForDrawing = jest.mocked(placeFurnitureForDrawing);
const mockedBuildDxfFromDrawing = jest.mocked(buildDxfFromDrawing);
const mockedBuildSvgPreviewDataUrl = jest.mocked(buildSvgPreviewDataUrl);
const mockedIsArchBuilderServerUnavailable = jest.mocked(isArchBuilderServerUnavailable);
const mockedLocalizedArchBuilderMessage = jest.mocked(localizedArchBuilderMessage);
const mockedGetArchBuilderAccessForUser = jest.mocked(getArchBuilderAccessForUser);
const mockedGetRequestLanguage = jest.mocked(getRequestLanguage);

function createRequest(body: unknown) {
  return {
    nextUrl: {
      pathname: '/api/archbuilder/sessions/session-1/place-furniture',
    },
    json: jest.fn().mockResolvedValue(body),
  };
}

async function loadRoute() {
  const mod = await import('@/app/api/archbuilder/sessions/[id]/place-furniture/route');
  return mod.POST;
}

describe('POST /api/archbuilder/sessions/[id]/place-furniture', () => {
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
      if (params.stepKey === 'drawing') {
        return {
          $id: 'drawing-step',
          output_json: JSON.stringify({
            units: 'm',
            rooms: [
              {
                spaceId: 'space-a',
                floor: 0,
                polygon: [
                  { x: 0, y: 0 },
                  { x: 10, y: 0 },
                  { x: 10, y: 10 },
                  { x: 0, y: 10 },
                ],
              },
            ],
          }),
        } as never;
      }

      if (params.stepKey === 'furniture') {
        return {
          $id: 'furniture-step',
          output_json: JSON.stringify({ placements: [] }),
        } as never;
      }

      return null as never;
    });

    mockedPlaceFurnitureForDrawing.mockReturnValue([
      {
        assetKey: 'table.standard.rect.01',
        category: 'table',
        roomId: 'space-a',
        x: 4,
        y: 4,
        width: 1.6,
        depth: 0.8,
        rotationDeg: 0,
        collisionScore: 0,
      },
    ]);

    mockedBuildDxfFromDrawing.mockReturnValue('DXF_WITH_FURNITURE');
    mockedBuildSvgPreviewDataUrl.mockReturnValue('SVG_WITH_FURNITURE');

    mockListRows.mockImplementation(async ({ tableId }: { tableId: string }) => {
      if (tableId === APPWRITE_TABLE_ARCHBUILDER_FURNITURE_PLACEMENTS_ID) {
        return { rows: [] };
      }

      if (tableId === APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID) {
        return {
          rows: [
            {
              $id: 'exp-1',
              export_format: 'DXF',
              payload_json: JSON.stringify({ drawing: { units: 'm' }, content: 'OLD_DXF' }),
            },
            {
              $id: 'exp-2',
              export_format: 'PNG',
              payload_json: JSON.stringify({ drawing: { units: 'm' }, svgDataUrl: 'OLD_SVG' }),
            },
          ],
        };
      }

      return { rows: [] };
    });

    mockCreateRow.mockResolvedValue({ $id: 'placement-1' });
    mockUpdateRow.mockResolvedValue(undefined);
    mockDeleteRow.mockResolvedValue(undefined);
  });

  it('updates existing exports to include furniture geometry payload', async () => {
    const POST = await loadRoute();

    const response = await POST(createRequest({ quantities: { table: 1 } }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        exportsUpdated: 2,
        includeFurniture: true,
        placements: expect.arrayContaining([
          expect.objectContaining({ assetKey: 'table.standard.rect.01' }),
        ]),
      }),
    );

    const exportUpdateCalls = mockUpdateRow.mock.calls
      .map((call) => call[0])
      .filter((call) => call.tableId === APPWRITE_TABLE_ARCHBUILDER_EXPORTS_ID);

    const furnitureStepUpdateCalls = mockUpdateRow.mock.calls
      .map((call) => call[0])
      .filter((call) => call.tableId === APPWRITE_TABLE_ARCHBUILDER_STEP_OUTPUTS_ID);

    expect(exportUpdateCalls).toHaveLength(2);
    expect(furnitureStepUpdateCalls.length).toBeGreaterThan(0);
    for (const call of exportUpdateCalls) {
      expect(call.data.include_furniture).toBe(true);
      expect(call.data.payload_json).toContain('"furniture"');
    }

    expect(mockedBuildDxfFromDrawing).toHaveBeenCalled();
    expect(mockedBuildSvgPreviewDataUrl).toHaveBeenCalled();
  });
});
