import {
  VALID_ARCHBUILDER_PROGRAM_FIXTURE,
  VALID_ARCHBUILDER_STACKING_FIXTURE,
} from '@/lib/archbuilder/fixtures';
import {
  runDeterministicPlanningChecks,
  validateAreaSumConsistency,
  validateFloorAllocationConsistency,
  validateNoDuplicateSpaces,
} from '@/lib/archbuilder/validators';

describe('archbuilder deterministic validators', () => {
  it('passes all deterministic checks with valid fixtures', () => {
    const result = runDeterministicPlanningChecks({
      program: VALID_ARCHBUILDER_PROGRAM_FIXTURE,
      stacking: VALID_ARCHBUILDER_STACKING_FIXTURE,
      envelopeGrossAreaM2: 4000,
    });

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects area mismatches', () => {
    const program = {
      ...VALID_ARCHBUILDER_PROGRAM_FIXTURE,
      spaces: VALID_ARCHBUILDER_PROGRAM_FIXTURE.spaces.map((space) => ({
        ...space,
        areaM2: space.areaM2 * 1.5,
      })),
    };

    const result = validateAreaSumConsistency(program, 3000, 0.05);
    expect(result.ok).toBe(false);
    expect(result.issues.some((item) => item.code === 'AREA_SUM_MISMATCH')).toBe(true);
  });

  it('detects duplicate space ids and names', () => {
    const program = {
      ...VALID_ARCHBUILDER_PROGRAM_FIXTURE,
      spaces: [
        ...VALID_ARCHBUILDER_PROGRAM_FIXTURE.spaces,
        {
          id: VALID_ARCHBUILDER_PROGRAM_FIXTURE.spaces[0].id,
          name: VALID_ARCHBUILDER_PROGRAM_FIXTURE.spaces[0].name,
          departmentId: VALID_ARCHBUILDER_PROGRAM_FIXTURE.spaces[0].departmentId,
          areaM2: 20,
          floor: VALID_ARCHBUILDER_PROGRAM_FIXTURE.spaces[0].floor,
        },
      ],
    };

    const result = validateNoDuplicateSpaces(program);
    expect(result.ok).toBe(false);
    expect(result.issues.some((item) => item.code === 'DUPLICATE_SPACE_ID')).toBe(true);
    expect(result.issues.some((item) => item.code === 'DUPLICATE_SPACE_NAME')).toBe(true);
  });

  it('detects invalid floor allocation', () => {
    const stacking = {
      floors: [{ floor: 0, departmentIds: ['dept-common'] }],
    };

    const result = validateFloorAllocationConsistency(VALID_ARCHBUILDER_PROGRAM_FIXTURE, stacking);
    expect(result.ok).toBe(false);
    expect(result.issues.some((item) => item.code === 'INVALID_FLOOR_ALLOCATION')).toBe(true);
    expect(result.issues.some((item) => item.code === 'UNALLOCATED_DEPARTMENT')).toBe(true);
  });
});
