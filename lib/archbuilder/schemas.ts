import { z } from 'zod';

export const ARCHBUILDER_PLANNING_STEPS = [
  'site',
  'constraints',
  'envelope',
  'program',
  'stacking',
  'adjacency',
] as const;

export type ArchBuilderPlanningStep = (typeof ARCHBUILDER_PLANNING_STEPS)[number];

const requiredText = z.string().trim().min(1);

export const archBuilderBudgetSchema = z.object({
  value: z.number().finite().nonnegative(),
  currency: z.string().trim().min(3).max(8),
});

export const archBuilderProjectIntentSchema = z.object({
  title: requiredText.max(120),
  projectType: requiredText.max(80),
  location: requiredText.max(140),
  targetAreaM2: z.number().finite().positive().max(2_000_000),
  budget: archBuilderBudgetSchema.optional(),
  constraints: z.array(requiredText.max(200)).default([]),
  priorities: z.array(requiredText.max(60)).default([]),
});

export const archBuilderAssumptionSchema = z.object({
  id: requiredText.max(64),
  title: requiredText.max(120),
  detail: requiredText.max(500),
  confidence: z.number().finite().min(0).max(1),
  needsConfirmation: z.boolean().default(true),
});

export const archBuilderConfidenceModelSchema = z.object({
  score: z.number().finite().min(0).max(1),
  assumptions: z.array(archBuilderAssumptionSchema),
});

export const archBuilderSiteAnalysisSchema = z.object({
  siteAreaM2: z.number().finite().positive().max(5_000_000),
  buildableRatio: z.number().finite().min(0).max(1),
  maxHeightMeters: z.number().finite().positive().max(1_000),
  contextNotes: z.array(requiredText.max(300)).default([]),
});

export const archBuilderConstraintSchema = z.object({
  code: requiredText.max(64),
  description: requiredText.max(300),
  severity: z.enum(['low', 'medium', 'high']),
});

export const archBuilderEnvelopeSchema = z.object({
  grossAreaM2: z.number().finite().positive().max(2_000_000),
  floorCount: z.number().int().min(1).max(400),
  maxFootprintM2: z.number().finite().positive().max(2_000_000),
  constraints: z.array(archBuilderConstraintSchema).default([]),
});

export const archBuilderDepartmentSchema = z.object({
  id: requiredText.max(64),
  name: requiredText.max(100),
  targetAreaM2: z.number().finite().positive().max(500_000),
  minAreaM2: z.number().finite().nonnegative().max(500_000),
  maxAreaM2: z.number().finite().positive().max(500_000),
  priority: z.enum(['core', 'support', 'optional']).default('core'),
});

export const archBuilderSpaceSchema = z.object({
  id: requiredText.max(64),
  name: requiredText.max(120),
  departmentId: requiredText.max(64),
  areaM2: z.number().finite().positive().max(200_000),
  floor: z.number().int().min(0).max(400),
});

export const archBuilderProgramSchema = z.object({
  departments: z.array(archBuilderDepartmentSchema).min(1),
  spaces: z.array(archBuilderSpaceSchema).min(1),
});

export const archBuilderStackingFloorSchema = z.object({
  floor: z.number().int().min(0).max(400),
  departmentIds: z.array(requiredText.max(64)).min(1),
});

export const archBuilderStackingSchema = z.object({
  floors: z.array(archBuilderStackingFloorSchema).min(1),
});

export const archBuilderAdjacencyNodeSchema = z.object({
  id: requiredText.max(64),
  label: requiredText.max(120),
});

export const archBuilderAdjacencyEdgeSchema = z.object({
  from: requiredText.max(64),
  to: requiredText.max(64),
  strength: z.number().int().min(1).max(5),
  required: z.boolean().default(false),
});

export const archBuilderAdjacencyGraphSchema = z.object({
  nodes: z.array(archBuilderAdjacencyNodeSchema).min(1),
  edges: z.array(archBuilderAdjacencyEdgeSchema),
});

export const archBuilderPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const archBuilderRoomGeometrySchema = z.object({
  spaceId: requiredText.max(64),
  floor: z.number().int().min(0).max(400),
  polygon: z.array(archBuilderPointSchema).min(4),
});

export const archBuilderDrawingSchema = z.object({
  units: z.literal('m'),
  rooms: z.array(archBuilderRoomGeometrySchema).min(1),
});

export const archBuilderExportRequestSchema = z.object({
  format: z.enum(['DXF', 'IFC', 'PNG']),
  includeFurniture: z.boolean().default(false),
  includeMetadata: z.boolean().default(true),
});

export const archBuilderSessionStateSchema = z.object({
  currentStep: z.enum(ARCHBUILDER_PLANNING_STEPS),
  completedSteps: z.array(z.enum(ARCHBUILDER_PLANNING_STEPS)).default([]),
  approvedSteps: z.array(z.enum(ARCHBUILDER_PLANNING_STEPS)).default([]),
});

export type ArchBuilderProjectIntent = z.infer<typeof archBuilderProjectIntentSchema>;
export type ArchBuilderConfidenceModel = z.infer<typeof archBuilderConfidenceModelSchema>;
export type ArchBuilderSiteAnalysis = z.infer<typeof archBuilderSiteAnalysisSchema>;
export type ArchBuilderEnvelope = z.infer<typeof archBuilderEnvelopeSchema>;
export type ArchBuilderProgram = z.infer<typeof archBuilderProgramSchema>;
export type ArchBuilderStacking = z.infer<typeof archBuilderStackingSchema>;
export type ArchBuilderAdjacencyGraph = z.infer<typeof archBuilderAdjacencyGraphSchema>;
export type ArchBuilderDrawing = z.infer<typeof archBuilderDrawingSchema>;
export type ArchBuilderExportRequest = z.infer<typeof archBuilderExportRequestSchema>;
export type ArchBuilderSessionState = z.infer<typeof archBuilderSessionStateSchema>;
