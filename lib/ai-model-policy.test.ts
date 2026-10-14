import { hasUnsupportedConfiguredModel, isUnsupportedModelId } from '@/lib/ai-model-policy';

describe('isUnsupportedModelId', () => {
  it.each([
    'google/gemini-3.1-flash-lite-preview',
    'google/gemini-2.0-flash-exp',
    'vendor/model-experimental',
  ])('flags %s', (model) => {
    expect(isUnsupportedModelId(model)).toBe(true);
  });

  it.each(['google/gemini-2.5-flash-lite', 'google/gemini-2.5-pro', 'openai/gpt-5'])('allows %s', (model) => {
    expect(isUnsupportedModelId(model)).toBe(false);
  });
});

describe('hasUnsupportedConfiguredModel', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('flags the built-in preview default when no model is configured', () => {
    process.env.AI_API_KEY = 'test-key';
    delete process.env.AI_MODEL;
    delete process.env.AI_MODEL_LOW_COST;
    delete process.env.AI_MODEL_TEXT_CHEAP;
    expect(hasUnsupportedConfiguredModel()).toBe(true);
  });

  it('passes when both tiers point at stable models', () => {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'google/gemini-2.5-flash';
    process.env.AI_MODEL_LOW_COST = 'google/gemini-2.5-flash-lite';
    expect(hasUnsupportedConfiguredModel()).toBe(false);
  });

  it('fails closed when only the low-cost tier is unsupported', () => {
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_MODEL = 'google/gemini-2.5-flash';
    process.env.AI_MODEL_LOW_COST = 'google/gemini-3.1-flash-lite-preview';
    expect(hasUnsupportedConfiguredModel()).toBe(true);
  });

  it('does not block when no provider is configured (the route reports that separately)', () => {
    delete process.env.AI_API_KEY;
    expect(hasUnsupportedConfiguredModel()).toBe(false);
  });
});
