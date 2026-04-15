import {
  archBuilderAdjacencyGraphSchema,
  archBuilderDrawingSchema,
  archBuilderEnvelopeSchema,
  archBuilderProgramSchema,
  archBuilderSiteAnalysisSchema,
  archBuilderStackingSchema,
  type ArchBuilderDrawing,
  type ArchBuilderProgram,
  type ArchBuilderProjectIntent,
  type ArchBuilderPlanningStep,
} from '@/lib/archbuilder/schemas';
import { runDeterministicPlanningChecks } from '@/lib/archbuilder/validators';

export type ArchBuilderFurniturePlacement = {
  assetKey: string;
  category: 'table' | 'chair' | 'flower' | 'tree';
  roomId: string;
  x: number;
  y: number;
  width: number;
  depth: number;
  rotationDeg: number;
  collisionScore: number;
};

export type ArchBuilderFurnitureQuantityMap = {
  table?: number;
  chair?: number;
  flower?: number;
  tree?: number;
};

export type ArchBuilderStepComputation = {
  output: Record<string, unknown>;
  confidenceScore: number;
  assumptions: string[];
  clarifications: string[];
};

const STEP_CONFIDENCE: Record<ArchBuilderPlanningStep, number> = {
  site: 82,
  constraints: 76,
  envelope: 74,
  program: 71,
  stacking: 69,
  adjacency: 67,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, precision = 2): number {
  const unit = 10 ** precision;
  return Math.round(value * unit) / unit;
}

function buildAssumptions(intent: ArchBuilderProjectIntent): string[] {
  return [
    `Target gross area includes 8-12% circulation overhead for ${intent.projectType}.`,
    'Core services and wet areas are centralized for stack efficiency.',
    `Envelope massing prioritizes daylight and ventilation targets in ${intent.location}.`,
  ];
}

function buildClarifications(intent: ArchBuilderProjectIntent, step: ArchBuilderPlanningStep): string[] {
  if (step === 'site') {
    return [`Confirm surveyed site boundary values around ${intent.location}.`];
  }
  if (step === 'constraints') {
    return ['Confirm local municipality setback and fire egress codes.'];
  }
  if (step === 'envelope') {
    return ['Confirm preferred max floor count and structural grid assumptions.'];
  }
  if (step === 'program') {
    return ['Validate functional ratios between core and support departments.'];
  }
  if (step === 'stacking') {
    return ['Validate floor stacking against vertical circulation strategy.'];
  }
  return ['Validate key near-adjacency and avoid-adjacency rules with design team.'];
}

function buildSite(intent: ArchBuilderProjectIntent) {
  const targetArea = intent.targetAreaM2;
  const siteAreaM2 = round(targetArea / 0.56);
  const buildableRatio = 0.6;
  const maxHeightMeters = clamp(Math.ceil(targetArea / 550), 12, 48);

  return archBuilderSiteAnalysisSchema.parse({
    siteAreaM2,
    buildableRatio,
    maxHeightMeters,
    contextNotes: [
      `Primary access assumes proximity to ${intent.location}.`,
      'Sun path prioritizes east-west natural lighting balance.',
    ],
  });
}

function buildConstraints(intent: ArchBuilderProjectIntent) {
  const normalized = intent.constraints.map((text, index) => ({
    code: `INTENT-${index + 1}`,
    description: text,
    severity: 'medium' as const,
  }));

  if (!normalized.length) {
    normalized.push({
      code: 'BASE-SETBACK',
      description: 'Default 5m perimeter setback assumed until legal confirmation.',
      severity: 'medium',
    });
  }

  return {
    constraints: normalized,
    source: 'intent',
  };
}

function buildEnvelope(intent: ArchBuilderProjectIntent, site: ReturnType<typeof buildSite>) {
  const floorCount = clamp(Math.ceil(intent.targetAreaM2 / 900), 1, 14);
  const grossAreaM2 = round(intent.targetAreaM2 * 1.1);
  const maxFootprintM2 = round(Math.min(site.siteAreaM2 * site.buildableRatio, grossAreaM2 / floorCount * 1.15));

  return archBuilderEnvelopeSchema.parse({
    grossAreaM2,
    floorCount,
    maxFootprintM2,
    constraints: [
      {
        code: 'ENV-MASSING',
        description: 'Envelope optimized for compact circulation and daylight penetration.',
        severity: 'medium',
      },
    ],
  });
}

function buildProgram(intent: ArchBuilderProjectIntent, envelopeFloorCount: number) {
  const coreArea = round(intent.targetAreaM2 * 0.72);
  const supportArea = round(intent.targetAreaM2 - coreArea);

  const floorsForCore = clamp(envelopeFloorCount - 1, 1, 8);
  const unitArea = round(coreArea / floorsForCore);

  const spaces: ArchBuilderProgram['spaces'] = [
    { id: 'space-lobby-main', name: 'Main Lobby', departmentId: 'dept-support', areaM2: round(supportArea * 0.35), floor: 0 },
    { id: 'space-services', name: 'Service Core', departmentId: 'dept-support', areaM2: round(supportArea * 0.3), floor: 0 },
    { id: 'space-social', name: 'Social Commons', departmentId: 'dept-support', areaM2: round(supportArea * 0.35), floor: 0 },
  ];

  for (let floor = 1; floor <= floorsForCore; floor += 1) {
    spaces.push({
      id: `space-core-${floor}`,
      name: `Core Program Floor ${floor}`,
      departmentId: 'dept-core',
      areaM2: unitArea,
      floor,
    });
  }

  return archBuilderProgramSchema.parse({
    departments: [
      {
        id: 'dept-core',
        name: `${intent.projectType} Core`,
        targetAreaM2: coreArea,
        minAreaM2: round(coreArea * 0.9),
        maxAreaM2: round(coreArea * 1.1),
        priority: 'core',
      },
      {
        id: 'dept-support',
        name: 'Support & Shared',
        targetAreaM2: supportArea,
        minAreaM2: round(supportArea * 0.8),
        maxAreaM2: round(supportArea * 1.2),
        priority: 'support',
      },
    ],
    spaces,
  });
}

function buildStacking(program: ArchBuilderProgram) {
  const floors = new Map<number, Set<string>>();

  for (const space of program.spaces) {
    if (!floors.has(space.floor)) {
      floors.set(space.floor, new Set());
    }
    floors.get(space.floor)?.add(space.departmentId);
  }

  return archBuilderStackingSchema.parse({
    floors: Array.from(floors.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, ids]) => ({
        floor,
        departmentIds: Array.from(ids),
      })),
  });
}

function buildAdjacency(program: ArchBuilderProgram) {
  const nodes = program.spaces.map((space) => ({
    id: space.id,
    label: space.name,
  }));

  const edges = program.spaces.slice(1).map((space, index) => ({
    from: program.spaces[index].id,
    to: space.id,
    strength: space.floor === program.spaces[index].floor ? 4 : 2,
    required: index < 3,
  }));

  return archBuilderAdjacencyGraphSchema.parse({
    nodes,
    edges,
  });
}

export function buildPlanningStepOutput(params: {
  step: ArchBuilderPlanningStep;
  intent: ArchBuilderProjectIntent;
  previousOutputs: Record<string, unknown>;
}): ArchBuilderStepComputation {
  const assumptions = buildAssumptions(params.intent);
  const clarifications = buildClarifications(params.intent, params.step);

  let output: Record<string, unknown>;

  if (params.step === 'site') {
    output = buildSite(params.intent);
  } else if (params.step === 'constraints') {
    output = buildConstraints(params.intent);
  } else if (params.step === 'envelope') {
    const site = buildSite(params.intent);
    output = buildEnvelope(params.intent, site);
  } else if (params.step === 'program') {
    const envelope = buildEnvelope(params.intent, buildSite(params.intent));
    output = buildProgram(params.intent, envelope.floorCount);
  } else if (params.step === 'stacking') {
    const envelope = buildEnvelope(params.intent, buildSite(params.intent));
    const program = buildProgram(params.intent, envelope.floorCount);
    output = buildStacking(program);
  } else {
    const envelope = buildEnvelope(params.intent, buildSite(params.intent));
    const program = buildProgram(params.intent, envelope.floorCount);
    const stacking = buildStacking(program);
    const adjacency = buildAdjacency(program);
    const checks = runDeterministicPlanningChecks({
      program,
      stacking,
      envelopeGrossAreaM2: envelope.grossAreaM2,
    });

    output = {
      ...adjacency,
      validation: checks,
    };
  }

  return {
    output,
    confidenceScore: STEP_CONFIDENCE[params.step],
    assumptions,
    clarifications,
  };
}

export function buildDrawingFromProgram(program: ArchBuilderProgram): ArchBuilderDrawing {
  const groupedByFloor = new Map<number, ArchBuilderProgram['spaces']>();

  for (const space of program.spaces) {
    if (!groupedByFloor.has(space.floor)) {
      groupedByFloor.set(space.floor, []);
    }
    groupedByFloor.get(space.floor)?.push(space);
  }

  const rooms = Array.from(groupedByFloor.entries())
    .sort((a, b) => a[0] - b[0])
    .flatMap(([floor, spaces]) => {
      let cursorX = 0;
      const cursorY = floor * 120;

      return spaces.map((space) => {
        const width = round(Math.sqrt(space.areaM2 * 1.4), 3);
        const depth = round(space.areaM2 / Math.max(width, 0.001), 3);
        const x = cursorX;
        const y = cursorY;
        cursorX += width + 2.5;

        return {
          spaceId: space.id,
          floor,
          polygon: [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + depth },
            { x, y: y + depth },
          ],
        };
      });
    });

  return archBuilderDrawingSchema.parse({
    units: 'm',
    rooms,
  });
}

function aabbOverlaps(a: ArchBuilderFurniturePlacement, b: ArchBuilderFurniturePlacement): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
    Math.abs(a.y - b.y) < (a.depth + b.depth) / 2
  );
}

function furnitureSpec(category: ArchBuilderFurniturePlacement['category']) {
  if (category === 'table') return { width: 1.6, depth: 0.8, assetKey: 'table.standard.rect.01' };
  if (category === 'chair') return { width: 0.5, depth: 0.5, assetKey: 'chair.standard.01' };
  if (category === 'flower') return { width: 0.35, depth: 0.35, assetKey: 'flower.pot.small.01' };
  return { width: 0.9, depth: 0.9, assetKey: 'tree.indoor.medium.01' };
}

export function placeFurnitureForDrawing(params: {
  drawing: ArchBuilderDrawing;
  quantities?: ArchBuilderFurnitureQuantityMap;
}): ArchBuilderFurniturePlacement[] {
  const quantities: Required<ArchBuilderFurnitureQuantityMap> = {
    table: clamp(params.quantities?.table ?? 4, 0, 100),
    chair: clamp(params.quantities?.chair ?? 8, 0, 200),
    flower: clamp(params.quantities?.flower ?? 4, 0, 100),
    tree: clamp(params.quantities?.tree ?? 2, 0, 100),
  };

  const placements: ArchBuilderFurniturePlacement[] = [];
  const categories: Array<keyof typeof quantities> = ['table', 'chair', 'flower', 'tree'];

  for (const category of categories) {
    const count = quantities[category];
    for (let i = 0; i < count; i += 1) {
      const room = params.drawing.rooms[i % params.drawing.rooms.length];
      const p0 = room.polygon[0];
      const p2 = room.polygon[2];
      const centerX = (p0.x + p2.x) / 2 + ((i % 3) - 1) * 0.6;
      const centerY = (p0.y + p2.y) / 2 + (((Math.floor(i / 3)) % 3) - 1) * 0.6;

      const spec = furnitureSpec(category);
      const next: ArchBuilderFurniturePlacement = {
        assetKey: spec.assetKey,
        category,
        roomId: room.spaceId,
        x: round(centerX, 3),
        y: round(centerY, 3),
        width: spec.width,
        depth: spec.depth,
        rotationDeg: (i % 4) * 90,
        collisionScore: 0,
      };

      const overlaps = placements.reduce((sum, previous) => sum + (aabbOverlaps(previous, next) ? 1 : 0), 0);
      next.collisionScore = overlaps;
      placements.push(next);
    }
  }

  return placements;
}

export function buildDxfFromDrawing(
  drawing: ArchBuilderDrawing,
  placements: ArchBuilderFurniturePlacement[] = [],
): string {
  const lines: string[] = [];

  lines.push('0', 'SECTION', '2', 'ENTITIES');

  for (const room of drawing.rooms) {
    lines.push('0', 'LWPOLYLINE');
    lines.push('8', `FLOOR_${room.floor}`);
    lines.push('90', String(room.polygon.length));
    lines.push('70', '1');

    for (const point of room.polygon) {
      lines.push('10', String(point.x));
      lines.push('20', String(point.y));
    }
  }

  for (const placement of placements) {
    lines.push('0', 'POINT');
    lines.push('8', `FURNITURE_${placement.category.toUpperCase()}`);
    lines.push('10', String(placement.x));
    lines.push('20', String(placement.y));
  }

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}

export function buildSvgPreviewDataUrl(
  drawing: ArchBuilderDrawing,
  placements: ArchBuilderFurniturePlacement[] = [],
): string {
  const allPoints = drawing.rooms.flatMap((room) => room.polygon);
  const minX = Math.min(...allPoints.map((point) => point.x));
  const minY = Math.min(...allPoints.map((point) => point.y));
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const maxY = Math.max(...allPoints.map((point) => point.y));
  const width = Math.max(1, maxX - minX + 10);
  const height = Math.max(1, maxY - minY + 10);

  const roomPaths = drawing.rooms
    .map((room) => {
      const points = room.polygon
        .map((point) => `${round(point.x - minX + 5, 3)},${round(point.y - minY + 5, 3)}`)
        .join(' ');
      return `<polygon points="${points}" fill="rgba(14,116,144,0.18)" stroke="#0e7490" stroke-width="0.25" />`;
    })
    .join('');

  const furnitureMarks = placements
    .map((placement) => {
      const x = round(placement.x - minX + 5, 3);
      const y = round(placement.y - minY + 5, 3);
      return `<circle cx="${x}" cy="${y}" r="0.35" fill="#dc2626" />`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8fafc" />${roomPaths}${furnitureMarks}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}
