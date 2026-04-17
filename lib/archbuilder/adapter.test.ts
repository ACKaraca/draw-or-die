import {
  EXTERNAL_ARCHBUILDER_SAMPLE_FIXTURE,
  EXTERNAL_ARCHBUILDER_SAMPLE_WITH_GAPS_FIXTURE,
} from '@/lib/archbuilder/fixtures';
import { normalizeExternalSampleToArchBuilder } from '@/lib/archbuilder/adapter';

describe('archbuilder adapter', () => {
  it('normalizes a complete external sample into internal planning schemas', () => {
    const result = normalizeExternalSampleToArchBuilder(EXTERNAL_ARCHBUILDER_SAMPLE_FIXTURE);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.sourceProvider).toBe('CompetePlan');
    expect(result.data.intent.title).toBe('Harbor Mixed Campus');
    expect(result.data.program.departments.length).toBeGreaterThan(1);
    expect(result.data.stacking.floors.length).toBeGreaterThan(0);
    expect(result.data.adjacency.nodes.length).toBeGreaterThan(1);
    expect(result.data.gapReport.fallbackFields.length).toBe(0);
  });

  it('captures fallback and warning details for incomplete samples', () => {
    const result = normalizeExternalSampleToArchBuilder(EXTERNAL_ARCHBUILDER_SAMPLE_WITH_GAPS_FIXTURE);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.intent.location).toBe('Unknown location');
    expect(result.data.gapReport.fallbackFields).toContain('project.targetAreaSqm');
    expect(result.data.gapReport.fallbackFields).toContain('project.city');
    expect(result.data.gapReport.fallbackFields).toContain('stack');
    expect(result.data.gapReport.missingFields).toContain('zoning');
    expect(result.data.gapReport.warnings.length).toBeGreaterThan(0);
    expect(result.data.gapReport.enhancementRules.length).toBeGreaterThan(0);
  });

  it('returns a validation error for malformed external payloads', () => {
    const result = normalizeExternalSampleToArchBuilder({
      provider: 'BadPayload',
      project: {
        name: '',
      },
      departments: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.code).toBe('ARCHBUILDER_SAMPLE_INVALID');
    expect(result.issues && result.issues.length > 0).toBe(true);
  });
});
