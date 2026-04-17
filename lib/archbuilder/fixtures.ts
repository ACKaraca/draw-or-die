import type {
  ArchBuilderAdjacencyGraph,
  ArchBuilderEnvelope,
  ArchBuilderProgram,
  ArchBuilderProjectIntent,
  ArchBuilderSiteAnalysis,
  ArchBuilderStacking,
} from '@/lib/archbuilder/schemas';

export const VALID_ARCHBUILDER_INTENT_FIXTURE: ArchBuilderProjectIntent = {
  title: 'Studio Courtyard Housing',
  projectType: 'Residential',
  location: 'Antalya / Muratpasa',
  targetAreaM2: 3600,
  budget: {
    value: 180000000,
    currency: 'TRY',
  },
  constraints: ['Max 5 floors', 'Keep courtyard open to south'],
  priorities: ['Daylight', 'Walkability', 'Construction speed'],
};

export const VALID_ARCHBUILDER_SITE_FIXTURE: ArchBuilderSiteAnalysis = {
  siteAreaM2: 2400,
  buildableRatio: 0.6,
  maxHeightMeters: 21,
  contextNotes: ['North road frontage', 'Prevailing wind from west'],
};

export const VALID_ARCHBUILDER_ENVELOPE_FIXTURE: ArchBuilderEnvelope = {
  grossAreaM2: 3900,
  floorCount: 5,
  maxFootprintM2: 1350,
  constraints: [
    {
      code: 'SETBACK-N',
      description: '5m minimum north setback',
      severity: 'high',
    },
  ],
};

export const VALID_ARCHBUILDER_PROGRAM_FIXTURE: ArchBuilderProgram = {
  departments: [
    {
      id: 'dept-housing',
      name: 'Housing',
      targetAreaM2: 2500,
      minAreaM2: 2200,
      maxAreaM2: 2800,
      priority: 'core',
    },
    {
      id: 'dept-common',
      name: 'Common',
      targetAreaM2: 900,
      minAreaM2: 700,
      maxAreaM2: 1100,
      priority: 'support',
    },
  ],
  spaces: [
    { id: 'space-lobby', name: 'Main Lobby', departmentId: 'dept-common', areaM2: 180, floor: 0 },
    { id: 'space-gym', name: 'Gym', departmentId: 'dept-common', areaM2: 120, floor: 0 },
    { id: 'space-unit-a', name: 'Unit A', departmentId: 'dept-housing', areaM2: 780, floor: 1 },
    { id: 'space-unit-b', name: 'Unit B', departmentId: 'dept-housing', areaM2: 780, floor: 2 },
    { id: 'space-unit-c', name: 'Unit C', departmentId: 'dept-housing', areaM2: 780, floor: 3 },
    { id: 'space-unit-d', name: 'Unit D', departmentId: 'dept-housing', areaM2: 780, floor: 4 },
  ],
};

export const VALID_ARCHBUILDER_STACKING_FIXTURE: ArchBuilderStacking = {
  floors: [
    { floor: 0, departmentIds: ['dept-common'] },
    { floor: 1, departmentIds: ['dept-housing'] },
    { floor: 2, departmentIds: ['dept-housing'] },
    { floor: 3, departmentIds: ['dept-housing'] },
    { floor: 4, departmentIds: ['dept-housing'] },
  ],
};

export const VALID_ARCHBUILDER_ADJACENCY_FIXTURE: ArchBuilderAdjacencyGraph = {
  nodes: [
    { id: 'space-lobby', label: 'Main Lobby' },
    { id: 'space-gym', label: 'Gym' },
    { id: 'space-unit-a', label: 'Unit A' },
  ],
  edges: [
    { from: 'space-lobby', to: 'space-gym', strength: 4, required: true },
    { from: 'space-lobby', to: 'space-unit-a', strength: 3, required: true },
  ],
};

export const INVALID_ARCHBUILDER_INTENT_FIXTURE: unknown = {
  title: '',
  projectType: 'Residential',
  location: 'Antalya',
  targetAreaM2: -10,
};

export const INVALID_ARCHBUILDER_PROGRAM_FIXTURE: unknown = {
  departments: [],
  spaces: [
    { id: 'duplicate', name: 'Room', departmentId: 'missing', areaM2: -5, floor: -1 },
    { id: 'duplicate', name: 'Room', departmentId: 'missing', areaM2: 12, floor: -1 },
  ],
};

export const EXTERNAL_ARCHBUILDER_SAMPLE_FIXTURE = {
  provider: 'CompetePlan',
  project: {
    name: 'Harbor Mixed Campus',
    kind: 'Mixed-Use',
    city: 'Izmir / Konak',
    targetAreaSqm: 5200,
  },
  priorities: ['Daylight', 'Public plaza', 'Construction speed'],
  zoning: {
    siteAreaSqm: 4100,
    buildableRatio: 0.58,
    maxFloors: 6,
    maxHeightM: 25,
    notes: ['South-facing open edge', 'Noise from north arterial road'],
  },
  departments: [
    {
      key: 'dept_residential',
      label: 'Residential',
      areaTarget: 3000,
      priority: 'high' as const,
      spaces: [
        { key: 'space_a1', label: 'Unit A1', area: 700, floorLevel: 1 },
        { key: 'space_a2', label: 'Unit A2', area: 700, floorLevel: 2 },
        { key: 'space_a3', label: 'Unit A3', area: 700, floorLevel: 3 },
        { key: 'space_a4', label: 'Unit A4', area: 700, floorLevel: 4 },
      ],
    },
    {
      key: 'dept_common',
      label: 'Common Facilities',
      areaTarget: 1200,
      priority: 'medium' as const,
      spaces: [
        { key: 'space_lobby', label: 'Lobby', area: 260, floorLevel: 0 },
        { key: 'space_gym', label: 'Gym', area: 220, floorLevel: 0 },
        { key: 'space_library', label: 'Library', area: 240, floorLevel: 1 },
      ],
    },
    {
      key: 'dept_retail',
      label: 'Retail',
      areaTarget: 1000,
      priority: 'low' as const,
      spaces: [
        { key: 'space_shop_1', label: 'Shop 1', area: 260, floorLevel: 0 },
        { key: 'space_shop_2', label: 'Shop 2', area: 260, floorLevel: 0 },
      ],
    },
  ],
  adjacency: [
    { source: 'space_lobby', target: 'space_gym', weight: 4, mandatory: true },
    { source: 'space_lobby', target: 'space_shop_1', weight: 3, mandatory: true },
    { source: 'space_library', target: 'space_a1', weight: 3, mandatory: false },
  ],
  stack: [
    { level: 0, departments: ['dept_common', 'dept_retail'] },
    { level: 1, departments: ['dept_residential', 'dept_common'] },
    { level: 2, departments: ['dept_residential'] },
    { level: 3, departments: ['dept_residential'] },
    { level: 4, departments: ['dept_residential'] },
  ],
};

export const EXTERNAL_ARCHBUILDER_SAMPLE_WITH_GAPS_FIXTURE = {
  provider: 'SketchySuite',
  project: {
    name: 'Courtyard Retrofit',
  },
  departments: [
    {
      key: 'dept_learning',
      label: 'Learning',
      areaTarget: 1400,
      spaces: [
        { key: 'space_studio_1', label: 'Studio 1', area: 350 },
        { key: 'space_studio_2', label: 'Studio 2', area: 350 },
        { key: 'space_critique', label: 'Critique Hall', area: 300, floorLevel: 1 },
      ],
    },
    {
      key: 'dept_support',
      label: 'Support',
      areaTarget: 600,
      spaces: [
        { key: 'space_admin', label: 'Admin', area: 180 },
        { key: 'space_archive', label: 'Archive', area: 120, floorLevel: 0 },
      ],
    },
  ],
  adjacency: [
    { source: 'space_studio_1', target: 'space_critique', weight: 4 },
    { source: 'space_studio_2', target: 'space_unknown', weight: 2 },
  ],
};
