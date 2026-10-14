import { resolveAiProviderConfig, type AiModelTier } from '@/lib/ai-provider';

const MODEL_TIERS: AiModelTier[] = ['default', 'low-cost'];

// Preview/experimental ids are retired by the provider without a stable successor guarantee
// (DOD-11); a paid operation must not depend on them.
const UNSUPPORTED_MODEL_PATTERN = /(^|[-/._])(preview|exp|experimental)([-._]|$)/i;

export function isUnsupportedModelId(model: string): boolean {
  return UNSUPPORTED_MODEL_PATTERN.test(model.trim());
}

/**
 * True when any configured AI model tier points at an unsupported/retired model, so a paid
 * operation could bill the user for a call that is likely to fail or disappear.
 * An unreadable provider configuration also counts as unsafe.
 */
export function hasUnsupportedConfiguredModel(): boolean {
  try {
    return MODEL_TIERS.some((tier) => {
      const config = resolveAiProviderConfig(tier);
      return config !== null && isUnsupportedModelId(config.model);
    });
  } catch {
    return true;
  }
}
