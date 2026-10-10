import { readCleanEnv, readFirstCleanEnv, resolveAiBaseUrl } from '@/lib/ai-completion';

export const AI_DEFAULT_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
export const AI_DEFAULT_MODEL = 'google/gemini-3.1-flash-lite-preview';
export const AI_AUXILIARY_REQUEST_TIMEOUT_MS = 30_000;

const VERCEL_GATEWAY_HOSTNAME = 'ai-gateway.vercel.sh';
const GOOGLE_DIRECT_HOSTNAME = 'generativelanguage.googleapis.com';

export type AiModelTier = 'default' | 'low-cost';

export type AiProviderConfig = {
  apiKey: string;
  baseUrl: string;
  hostname: string;
  model: string;
};

const MODEL_ENV_NAMES_BY_TIER: Record<AiModelTier, string[]> = {
  default: ['AI_MODEL'],
  'low-cost': ['AI_MODEL_LOW_COST', 'AI_MODEL_TEXT_CHEAP', 'AI_MODEL'],
};

/**
 * The Vercel AI gateway and Google's OpenAI-compatible endpoint reject or mishandle
 * `response_format: json_object`, so it is only sent to the other providers.
 */
export function shouldSendJsonObjectFormat(hostname: string): boolean {
  return hostname !== VERCEL_GATEWAY_HOSTNAME && hostname !== GOOGLE_DIRECT_HOSTNAME;
}

/**
 * Returns null when AI_API_KEY is not configured.
 * Throws when AI_BASE_URL is malformed or not allowlisted.
 */
export function resolveAiProviderConfig(tier: AiModelTier = 'default'): AiProviderConfig | null {
  const apiKey = readCleanEnv('AI_API_KEY');
  if (!apiKey) return null;

  const { href, hostname } = resolveAiBaseUrl(readCleanEnv('AI_BASE_URL') || AI_DEFAULT_BASE_URL);
  const model = readFirstCleanEnv(MODEL_ENV_NAMES_BY_TIER[tier]) || AI_DEFAULT_MODEL;

  return { apiKey, baseUrl: href, hostname, model };
}
