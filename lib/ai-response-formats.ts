// Strict JSON-schema response formats for the jury/mentor operations.
// Same shape as DESIGN_INSIGHT_RESPONSE_FORMAT (lib/design-insights.ts), which is already
// proven against the AI gateway. Guaranteed-valid JSON avoids INVALID_AI_RESULT retries
// that users would otherwise pay for with time (and we pay for with tokens).

type JsonSchema = Record<string, unknown>;

export type AIResponseFormat = {
  type: 'json_schema';
  json_schema: {
    name: string;
    strict: true;
    schema: JsonSchema;
  };
};

const STRING: JsonSchema = { type: 'string' };
const NUMBER: JsonSchema = { type: 'number' };
const BOOLEAN: JsonSchema = { type: 'boolean' };
const SCORE: JsonSchema = { type: 'number', minimum: 0, maximum: 100 };
const GALLERY_PLACEMENT: JsonSchema = { type: 'string', enum: ['HALL_OF_FAME', 'WALL_OF_DEATH', 'NONE'] };

function strictObject(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function arrayOf(items: JsonSchema): JsonSchema {
  return { type: 'array', items };
}

function responseFormat(name: string, properties: Record<string, JsonSchema>): AIResponseFormat {
  return {
    type: 'json_schema',
    json_schema: {
      name,
      strict: true,
      schema: strictObject(properties),
    },
  };
}

export const SINGLE_JURY_RESPONSE_FORMAT = responseFormat('single_jury', {
  projectTitle: STRING,
  personaId: STRING,
  personaName: STRING,
  critique: STRING,
  score: SCORE,
  galleryPlacement: GALLERY_PLACEMENT,
});

export const REVISION_RESPONSE_FORMAT = responseFormat('revision_jury', {
  isSameProject: BOOLEAN,
  projectTitle: STRING,
  personaId: STRING,
  personaName: STRING,
  critique: STRING,
  score: SCORE,
  progressionScore: SCORE,
  galleryPlacement: GALLERY_PLACEMENT,
});

export const MULTI_JURY_RESPONSE_FORMAT = responseFormat('multi_jury', {
  projectTitle: STRING,
  personas: arrayOf(strictObject({
    id: STRING,
    name: STRING,
    critique: STRING,
    score: SCORE,
  })),
});

export const DEFENSE_RESPONSE_FORMAT = responseFormat('jury_defense', {
  juryResponse: STRING,
  scoreChange: { type: 'number', minimum: -20, maximum: 20 },
});

export const AUTO_FILL_RESPONSE_FORMAT = responseFormat('studio_desk_autofill', {
  topic: STRING,
  site: STRING,
  concept: STRING,
  defense: STRING,
  category: STRING,
  analysisLength: { type: 'string', enum: ['SHORT', 'MEDIUM', 'LONG'] },
});

export const CRITIQUE_RESPONSE_FORMAT = responseFormat('critique_text', {
  critique: STRING,
});

export const MENTOR_RESPONSE_FORMAT = responseFormat('mentor_reply', {
  reply: STRING,
  quickActions: arrayOf(strictObject({
    label: STRING,
    prompt: STRING,
  })),
});

export const PREMIUM_PDF_TEMPLATE_RESPONSE_FORMAT = responseFormat('premium_pdf_template', {
  pdfAnalyzable: BOOLEAN,
  globalSummary: STRING,
  pageGuides: arrayOf(strictObject({
    page: NUMBER,
    pageLabel: STRING,
    focus: STRING,
  })),
});

export const PREMIUM_RESCUE_RESPONSE_FORMAT = responseFormat('premium_rescue', {
  summary: STRING,
  flaws: arrayOf(strictObject({
    page: NUMBER,
    pageLabel: STRING,
    severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    x: NUMBER,
    y: NUMBER,
    width: NUMBER,
    height: NUMBER,
    reason: STRING,
    drawingGuide: STRING,
  })),
  drawingInstructions: arrayOf(STRING),
  practicalSolutions: arrayOf(STRING),
  reference: STRING,
});

/**
 * Structured outputs are on by default. `AI_STRUCTURED_OUTPUTS=off` is an instant
 * rollback switch if a provider/model combination ever rejects json_schema requests.
 */
export function isStructuredOutputEnabled(): boolean {
  const raw = (process.env.AI_STRUCTURED_OUTPUTS ?? '').trim().toLowerCase();
  return !(raw === 'off' || raw === 'false' || raw === '0');
}
