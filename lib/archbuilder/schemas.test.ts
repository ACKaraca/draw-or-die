import {
  archBuilderAdjacencyGraphSchema,
  archBuilderEnvelopeSchema,
  archBuilderProgramSchema,
  archBuilderProjectIntentSchema,
  archBuilderSiteAnalysisSchema,
  archBuilderStackingSchema,
} from '@/lib/archbuilder/schemas';
import {
  INVALID_ARCHBUILDER_INTENT_FIXTURE,
  INVALID_ARCHBUILDER_PROGRAM_FIXTURE,
  VALID_ARCHBUILDER_ADJACENCY_FIXTURE,
  VALID_ARCHBUILDER_ENVELOPE_FIXTURE,
  VALID_ARCHBUILDER_INTENT_FIXTURE,
  VALID_ARCHBUILDER_PROGRAM_FIXTURE,
  VALID_ARCHBUILDER_SITE_FIXTURE,
  VALID_ARCHBUILDER_STACKING_FIXTURE,
} from '@/lib/archbuilder/fixtures';

describe('archbuilder schemas', () => {
  it('accepts valid project intent fixture', () => {
    const parsed = archBuilderProjectIntentSchema.parse(VALID_ARCHBUILDER_INTENT_FIXTURE);
    expect(parsed.title).toBe('Studio Courtyard Housing');
    expect(parsed.targetAreaM2).toBe(3600);
  });

  it('rejects invalid project intent fixture', () => {
    const result = archBuilderProjectIntentSchema.safeParse(INVALID_ARCHBUILDER_INTENT_FIXTURE);
    expect(result.success).toBe(false);
  });

  it('accepts valid site, envelope, program, stacking and adjacency fixtures', () => {
    expect(() => archBuilderSiteAnalysisSchema.parse(VALID_ARCHBUILDER_SITE_FIXTURE)).not.toThrow();
    expect(() => archBuilderEnvelopeSchema.parse(VALID_ARCHBUILDER_ENVELOPE_FIXTURE)).not.toThrow();
    expect(() => archBuilderProgramSchema.parse(VALID_ARCHBUILDER_PROGRAM_FIXTURE)).not.toThrow();
    expect(() => archBuilderStackingSchema.parse(VALID_ARCHBUILDER_STACKING_FIXTURE)).not.toThrow();
    expect(() => archBuilderAdjacencyGraphSchema.parse(VALID_ARCHBUILDER_ADJACENCY_FIXTURE)).not.toThrow();
  });

  it('rejects invalid program fixture', () => {
    const result = archBuilderProgramSchema.safeParse(INVALID_ARCHBUILDER_PROGRAM_FIXTURE);
    expect(result.success).toBe(false);
  });
});
