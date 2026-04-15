import { z } from 'zod';
import {
  archBuilderAdjacencyGraphSchema,
  archBuilderEnvelopeSchema,
  archBuilderProgramSchema,
  archBuilderProjectIntentSchema,
  archBuilderSiteAnalysisSchema,
  archBuilderStackingSchema,
  type ArchBuilderAdjacencyGraph,
  type ArchBuilderEnvelope,
  type ArchBuilderProgram,
  type ArchBuilderProjectIntent,
  type ArchBuilderSiteAnalysis,
  type ArchBuilderStacking,
} from '@/lib/archbuilder/schemas';

const externalSpaceSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  area: z.number().finite().positive(),
  floorLevel: z.number().int().min(0).max(400).optional(),
});

const externalDepartmentSchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  areaTarget: z.number().finite().positive(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  spaces: z.array(externalSpaceSchema).min(1),
});

const externalAdjacencySchema = z.object({
  source: z.string().trim().min(1),
  target: z.string().trim().min(1),
  weight: z.number().finite().min(1).max(5).optional(),
  mandatory: z.boolean().optional(),
});

const externalStackSchema = z.object({
  level: z.number().int().min(0).max(400),
  departments: z.array(z.string().trim().min(1)).min(1),
});

export const externalArchBuilderSampleSchema = z.object({
  provider: z.string().trim().min(1),
  project: z.object({
    name: z.string().trim().min(1),
    kind: z.string().trim().min(1).optional(),
    city: z.string().trim().min(1).optional(),
    targetAreaSqm: z.number().finite().positive().optional(),
  }),
  priorities: z.array(z.string().trim().min(1)).optional(),
  zoning: z
    .object({
      siteAreaSqm: z.number().finite().positive().optional(),
      buildableRatio: z.number().finite().min(0).max(1).optional(),
      maxFloors: z.number().int().min(1).max(400).optional(),
      maxHeightM: z.number().finite().positive().optional(),
      notes: z.array(z.string().trim().min(1)).optional(),
    })
    .optional(),
  departments: z.array(externalDepartmentSchema).min(1),
  adjacency: z.array(externalAdjacencySchema).optional(),
  stack: z.array(externalStackSchema).optional(),
});

export type ExternalArchBuilderSample = z.infer<typeof externalArchBuilderSampleSchema>;

export type ArchBuilderSampleGapReport = {
  missingFields: string[];
  fallbackFields: string[];
  enhancementRules: string[];
  warnings: string[];
};

export type NormalizedArchBuilderSample = {
  sourceProvider: string;
  intent: ArchBuilderProjectIntent;
  site: ArchBuilderSiteAnalysis;
  envelope: ArchBuilderEnvelope;
  program: ArchBuilderProgram;
  stacking: ArchBuilderStacking;
  adjacency: ArchBuilderAdjacencyGraph;
  gapReport: ArchBuilderSampleGapReport;
};

export type NormalizeExternalSampleResult =
  | {
      ok: true;
      data: NormalizedArchBuilderSample;
    }
  | {
      ok: false;
      code: 'ARCHBUILDER_SAMPLE_INVALID' | 'ARCHBUILDER_SAMPLE_NORMALIZATION_FAILED';
      issues?: Array<{ path: string; message: string }>;
      message: string;
    };

function normalizeIdentifier(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function mapPriority(priority: 'high' | 'medium' | 'low' | undefined): 'core' | 'support' | 'optional' {
  if (priority === 'high') return 'core';
  if (priority === 'low') return 'optional';
  return 'support';
}

function roundArea(value: number): number {
  return Math.max(1, Math.round(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function buildDerivedStacking(program: ArchBuilderProgram): ArchBuilderStacking {
  const floors = new Map<number, Set<string>>();

  for (const space of program.spaces) {
    const existing = floors.get(space.floor) ?? new Set<string>();
    existing.add(space.departmentId);
    floors.set(space.floor, existing);
  }

  return {
    floors: Array.from(floors.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, departmentIds]) => ({
        floor,
        departmentIds: Array.from(departmentIds),
      })),
  };
}

export function normalizeExternalSampleToArchBuilder(
  input: unknown,
): NormalizeExternalSampleResult {
  const parsed = externalArchBuilderSampleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: 'ARCHBUILDER_SAMPLE_INVALID',
      message: 'External sample payload is invalid.',
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  try {
    const sample = parsed.data;
    const missingFields = new Set<string>();
    const fallbackFields = new Set<string>();
    const warnings = new Set<string>();

    const derivedTargetArea = sample.departments.reduce((sum, department) => sum + department.areaTarget, 0);
    const targetAreaM2 = sample.project.targetAreaSqm ?? derivedTargetArea;
    if (!sample.project.targetAreaSqm) {
      fallbackFields.add('project.targetAreaSqm');
    }

    if (!sample.project.kind) {
      fallbackFields.add('project.kind');
    }

    if (!sample.project.city) {
      fallbackFields.add('project.city');
    }

    const intent = archBuilderProjectIntentSchema.parse({
      title: sample.project.name,
      projectType: sample.project.kind ?? 'Mixed-Use',
      location: sample.project.city ?? 'Unknown location',
      targetAreaM2: roundArea(targetAreaM2),
      constraints: [],
      priorities: sample.priorities ?? ['Functionality', 'Daylight'],
    });

    if (!sample.priorities || sample.priorities.length === 0) {
      fallbackFields.add('priorities');
    }

    const inferredFloorCountFromSpaces =
      Math.max(...sample.departments.flatMap((department) => department.spaces.map((space) => space.floorLevel ?? 0))) + 1;

    const floorCount = sample.zoning?.maxFloors ?? inferredFloorCountFromSpaces;
    if (!sample.zoning?.maxFloors) {
      fallbackFields.add('zoning.maxFloors');
    }

    const siteAreaM2 = sample.zoning?.siteAreaSqm ?? roundArea(Math.max(targetAreaM2 * 1.6, targetAreaM2 + 500));
    if (!sample.zoning?.siteAreaSqm) {
      fallbackFields.add('zoning.siteAreaSqm');
    }

    const buildableRatio = sample.zoning?.buildableRatio ?? 0.6;
    if (typeof sample.zoning?.buildableRatio !== 'number') {
      fallbackFields.add('zoning.buildableRatio');
    }

    const maxHeightMeters = sample.zoning?.maxHeightM ?? floorCount * 3.5;
    if (!sample.zoning?.maxHeightM) {
      fallbackFields.add('zoning.maxHeightM');
    }

    if (!sample.zoning) {
      missingFields.add('zoning');
    }

    const site = archBuilderSiteAnalysisSchema.parse({
      siteAreaM2,
      buildableRatio,
      maxHeightMeters,
      contextNotes:
        sample.zoning?.notes && sample.zoning.notes.length > 0
          ? sample.zoning.notes
          : [`Imported sample from ${sample.provider}`],
    });

    if (!sample.zoning?.notes || sample.zoning.notes.length === 0) {
      fallbackFields.add('zoning.notes');
    }

    const departments = sample.departments.map((department) => ({
      id: normalizeIdentifier(department.key),
      name: department.label,
      targetAreaM2: roundArea(department.areaTarget),
      minAreaM2: roundArea(department.areaTarget * 0.85),
      maxAreaM2: roundArea(department.areaTarget * 1.15),
      priority: mapPriority(department.priority),
    }));

    const departmentByExternalKey = new Map<string, string>();
    for (const department of sample.departments) {
      departmentByExternalKey.set(department.key, normalizeIdentifier(department.key));
    }

    const spaces = sample.departments.flatMap((department) =>
      department.spaces.map((space) => {
        if (typeof space.floorLevel !== 'number') {
          fallbackFields.add(`spaces.${space.key}.floorLevel`);
        }

        return {
          id: normalizeIdentifier(space.key),
          name: space.label,
          departmentId: departmentByExternalKey.get(department.key) ?? normalizeIdentifier(department.key),
          areaM2: roundArea(space.area),
          floor: space.floorLevel ?? 0,
        };
      }),
    );

    const program = archBuilderProgramSchema.parse({
      departments,
      spaces,
    });

    let stackingDraft: ArchBuilderStacking;
    if (sample.stack && sample.stack.length > 0) {
      const knownDepartmentIds = new Set(program.departments.map((department) => department.id));
      const floors = sample.stack
        .map((item) => {
          const mappedDepartmentIds = item.departments
            .map((departmentKey) => {
              const resolved = departmentByExternalKey.get(departmentKey) ?? normalizeIdentifier(departmentKey);
              if (!knownDepartmentIds.has(resolved)) {
                warnings.add(`Stack floor ${item.level} references unknown department key: ${departmentKey}`);
                return null;
              }
              return resolved;
            })
            .filter((value): value is string => Boolean(value));

          return {
            floor: item.level,
            departmentIds: Array.from(new Set(mappedDepartmentIds)),
          };
        })
        .filter((item) => item.departmentIds.length > 0)
        .sort((a, b) => a.floor - b.floor);

      if (floors.length === 0) {
        warnings.add('Stack input was present but empty after normalization. Derived stacking from spaces.');
        stackingDraft = buildDerivedStacking(program);
      } else {
        stackingDraft = { floors };
      }
    } else {
      fallbackFields.add('stack');
      stackingDraft = buildDerivedStacking(program);
    }

    const allocatedDepartments = new Set(stackingDraft.floors.flatMap((floor) => floor.departmentIds));
    for (const department of program.departments) {
      if (allocatedDepartments.has(department.id)) {
        continue;
      }

      warnings.add(`Department ${department.id} was missing from stacking and assigned to floor 0.`);
      const floorZero = stackingDraft.floors.find((item) => item.floor === 0);
      if (floorZero) {
        floorZero.departmentIds.push(department.id);
      } else {
        stackingDraft.floors.push({
          floor: 0,
          departmentIds: [department.id],
        });
      }
    }

    const stacking = archBuilderStackingSchema.parse({
      floors: stackingDraft.floors
        .map((floor) => ({
          floor: floor.floor,
          departmentIds: Array.from(new Set(floor.departmentIds)),
        }))
        .sort((a, b) => a.floor - b.floor),
    });

    const envelope = archBuilderEnvelopeSchema.parse({
      grossAreaM2: roundArea(targetAreaM2 * 1.08),
      floorCount,
      maxFootprintM2: roundArea((targetAreaM2 * 1.08) / Math.max(1, floorCount)),
      constraints: sample.zoning?.maxFloors
        ? [
            {
              code: 'MAX_FLOORS',
              description: `Source sample max floors: ${sample.zoning.maxFloors}`,
              severity: 'medium',
            },
          ]
        : [],
    });

    const nodes = program.spaces.map((space) => ({
      id: space.id,
      label: space.name,
    }));

    const knownNodeIds = new Set(nodes.map((node) => node.id));
    const edges =
      sample.adjacency?.flatMap((edge) => {
        const from = normalizeIdentifier(edge.source);
        const to = normalizeIdentifier(edge.target);

        if (!knownNodeIds.has(from) || !knownNodeIds.has(to)) {
          warnings.add(
            `Adjacency edge ${edge.source} -> ${edge.target} could not be mapped to normalized spaces.`,
          );
          return [];
        }

        return [
          {
            from,
            to,
            strength: clamp(Math.round(edge.weight ?? 3), 1, 5),
            required: Boolean(edge.mandatory),
          },
        ];
      }) ?? [];

    if (!sample.adjacency || sample.adjacency.length === 0) {
      fallbackFields.add('adjacency');
    }

    if (edges.length === 0 && nodes.length >= 2) {
      warnings.add('Adjacency edges were inferred from node order.');
      edges.push({
        from: nodes[0].id,
        to: nodes[1].id,
        strength: 3,
        required: false,
      });
    }

    const adjacency = archBuilderAdjacencyGraphSchema.parse({
      nodes,
      edges,
    });

    const gapReport: ArchBuilderSampleGapReport = {
      missingFields: Array.from(missingFields),
      fallbackFields: Array.from(fallbackFields),
      enhancementRules: [
        'Provide explicit site zoning (siteAreaSqm, buildableRatio, maxFloors) to reduce inferred envelope values.',
        'Provide adjacency relationships for all critical spaces to avoid inferred circulation links.',
        'Provide floorLevel on every space for stable stacking consistency and fewer default assignments.',
      ],
      warnings: Array.from(warnings),
    };

    return {
      ok: true,
      data: {
        sourceProvider: sample.provider,
        intent,
        site,
        envelope,
        program,
        stacking,
        adjacency,
        gapReport,
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: 'ARCHBUILDER_SAMPLE_NORMALIZATION_FAILED',
      message: error instanceof Error ? error.message : 'Failed to normalize external sample payload.',
    };
  }
}
