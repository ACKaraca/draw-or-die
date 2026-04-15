import type { ArchBuilderProgram, ArchBuilderStacking } from '@/lib/archbuilder/schemas';

export type DeterministicValidationIssue = {
  code: 'AREA_SUM_MISMATCH' | 'DUPLICATE_SPACE_ID' | 'DUPLICATE_SPACE_NAME' | 'INVALID_FLOOR_ALLOCATION' | 'UNKNOWN_DEPARTMENT' | 'UNALLOCATED_DEPARTMENT';
  message: string;
};

export type DeterministicValidationResult = {
  ok: boolean;
  issues: DeterministicValidationIssue[];
};

export function validateAreaSumConsistency(
  program: ArchBuilderProgram,
  envelopeGrossAreaM2?: number,
  toleranceRatio = 0.05,
): DeterministicValidationResult {
  const issues: DeterministicValidationIssue[] = [];

  const targetDepartmentArea = program.departments.reduce((sum, item) => sum + item.targetAreaM2, 0);
  const plannedSpaceArea = program.spaces.reduce((sum, item) => sum + item.areaM2, 0);

  const denominator = Math.max(1, targetDepartmentArea);
  const ratio = Math.abs(plannedSpaceArea - targetDepartmentArea) / denominator;

  if (ratio > toleranceRatio) {
    issues.push({
      code: 'AREA_SUM_MISMATCH',
      message: `Program space area (${plannedSpaceArea.toFixed(1)} m2) does not align with department target area (${targetDepartmentArea.toFixed(1)} m2).`,
    });
  }

  if (typeof envelopeGrossAreaM2 === 'number' && Number.isFinite(envelopeGrossAreaM2)) {
    const allowed = envelopeGrossAreaM2 * (1 + toleranceRatio);
    if (plannedSpaceArea > allowed) {
      issues.push({
        code: 'AREA_SUM_MISMATCH',
        message: `Program space area (${plannedSpaceArea.toFixed(1)} m2) exceeds envelope gross area (${envelopeGrossAreaM2.toFixed(1)} m2).`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateNoDuplicateSpaces(program: ArchBuilderProgram): DeterministicValidationResult {
  const issues: DeterministicValidationIssue[] = [];

  const idSet = new Set<string>();
  const nameSet = new Set<string>();

  for (const space of program.spaces) {
    const normalizedName = space.name.trim().toLowerCase();

    if (idSet.has(space.id)) {
      issues.push({
        code: 'DUPLICATE_SPACE_ID',
        message: `Duplicate space id detected: ${space.id}.`,
      });
    }
    idSet.add(space.id);

    if (nameSet.has(normalizedName)) {
      issues.push({
        code: 'DUPLICATE_SPACE_NAME',
        message: `Duplicate space name detected: ${space.name}.`,
      });
    }
    nameSet.add(normalizedName);
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function validateFloorAllocationConsistency(
  program: ArchBuilderProgram,
  stacking: ArchBuilderStacking,
): DeterministicValidationResult {
  const issues: DeterministicValidationIssue[] = [];

  const departmentIds = new Set(program.departments.map((item) => item.id));
  const floorDepartmentAllocations = new Map<number, Set<string>>();

  for (const floor of stacking.floors) {
    floorDepartmentAllocations.set(floor.floor, new Set(floor.departmentIds));

    for (const departmentId of floor.departmentIds) {
      if (!departmentIds.has(departmentId)) {
        issues.push({
          code: 'UNKNOWN_DEPARTMENT',
          message: `Stacking references unknown department id: ${departmentId}.`,
        });
      }
    }
  }

  for (const space of program.spaces) {
    if (!departmentIds.has(space.departmentId)) {
      issues.push({
        code: 'UNKNOWN_DEPARTMENT',
        message: `Space ${space.id} references unknown department id: ${space.departmentId}.`,
      });
      continue;
    }

    const floorDepartments = floorDepartmentAllocations.get(space.floor);
    if (!floorDepartments || !floorDepartments.has(space.departmentId)) {
      issues.push({
        code: 'INVALID_FLOOR_ALLOCATION',
        message: `Space ${space.id} on floor ${space.floor} has no matching stacking allocation for department ${space.departmentId}.`,
      });
    }
  }

  for (const department of program.departments) {
    const allocated = stacking.floors.some((floor) => floor.departmentIds.includes(department.id));
    if (!allocated) {
      issues.push({
        code: 'UNALLOCATED_DEPARTMENT',
        message: `Department ${department.id} is not allocated to any floor in stacking.`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function runDeterministicPlanningChecks(params: {
  program: ArchBuilderProgram;
  stacking: ArchBuilderStacking;
  envelopeGrossAreaM2?: number;
}): DeterministicValidationResult {
  const area = validateAreaSumConsistency(params.program, params.envelopeGrossAreaM2);
  const duplicateSpaces = validateNoDuplicateSpaces(params.program);
  const floorAllocation = validateFloorAllocationConsistency(params.program, params.stacking);

  const issues = [...area.issues, ...duplicateSpaces.issues, ...floorAllocation.issues];
  return {
    ok: issues.length === 0,
    issues,
  };
}
