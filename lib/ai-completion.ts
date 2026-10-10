import { logServerInfo } from '@/lib/logger';
import { isStructuredOutputEnabled } from '@/lib/ai-response-formats';
import { pickLocalized, type SupportedLanguage } from '@/lib/i18n';

// OpenAI-compatible chat-completions client used by /api/ai-generate: provider allowlist,
// gateway model fallback, timeout budget, one retry on transient failures, usage logging.

const PROVIDER_ERROR_BODY_LOG_LIMIT = 1200;
const PROVIDER_DEBUG_KEY_FINGERPRINT_LENGTH = 12;
const SHOULD_INCLUDE_PROVIDER_ERROR_BODY = process.env.NODE_ENV === 'development';
const PROVIDER_ERROR_TYPE_NO_PROVIDERS_AVAILABLE = 'no_providers_available';
const PROVIDER_CREDIT_RESTRICTION_MESSAGE_FRAGMENT = 'free credits temporarily have restricted access';
const GEMINI_31_MODEL_PREFIX = 'google/gemini-3.1-';
const DEFAULT_AI_MODEL_FALLBACKS = 'google/gemini-2.5-flash-lite';

// Stays below the client's 120s timeout so users get a real error instead of a hung request.
const AI_PROVIDER_TOTAL_BUDGET_MS = 100_000;
const AI_PROVIDER_MIN_RETRY_BUDGET_MS = 25_000;
const AI_PROVIDER_MAX_ATTEMPTS = 2;
const AI_PROVIDER_RETRY_DELAY_MS = 600;
const AI_PROVIDER_MAX_RETRY_DELAY_MS = 3_000;
const RETRYABLE_PROVIDER_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const REASONING_EFFORT_VALUES = new Set(['none', 'minimal', 'low', 'medium', 'high']);
// Conversational / form-filling calls where latency matters more than deep reasoning.
const FAST_REASONING_OPERATIONS = new Set(['DEFENSE', 'AUTO_FILL_FORM', 'AUTO_CONCEPT', 'AI_MENTOR', 'SKILL_ROADMAP']);

export function readCleanEnv(name: string): string {
  const raw = process.env[name];
  if (typeof raw !== 'string') return '';

  const value = raw.trim();
  if (!value) return '';

  return /[\r\n\0]/.test(value) ? '' : value;
}

export function readFirstCleanEnv(names: string[]): string {
  for (const name of names) {
    const value = readCleanEnv(name);
    if (value) return value;
  }
  return '';
}

// Maps allowed AI provider hostnames to their canonical base URLs.
// The hostname from the env var is used ONLY as a lookup key — the returned value
// is our own hardcoded constant, never the user-provided URL (prevents SSRF).
const AI_PROVIDER_BASE_URLS = new Map<string, string>([
  ['ai-gateway.vercel.sh', 'https://ai-gateway.vercel.sh/v1'],
  ['generativelanguage.googleapis.com', 'https://generativelanguage.googleapis.com/v1beta/openai'],
  ['api.openai.com', 'https://api.openai.com/v1'],
  ['openrouter.ai', 'https://openrouter.ai/api/v1'],
  ['api.anthropic.com', 'https://api.anthropic.com/v1'],
]);

/**
 * Resolves the canonical base URL for an AI provider.
 * The env var URL is parsed ONLY to extract its hostname as a lookup key.
 * The returned href is our own constant — never derived from user input.
 */
export function resolveAiBaseUrl(rawUrl: string): { href: string; hostname: string } {
  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname;
  } catch {
    throw new Error(`Invalid AI base URL: ${rawUrl}`);
  }
  const href = AI_PROVIDER_BASE_URLS.get(hostname);
  if (!href) {
    throw new Error(`AI provider not in allowlist: ${hostname}`);
  }
  // href is our hardcoded constant — not derived from user input
  return { href, hostname };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readStringField(node: Record<string, unknown> | null, key: string): string | null {
  if (!node) return null;
  const value = node[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function fingerprintApiKey(apiKey: string): string {
  if (!apiKey) return 'missing';
  const normalized = apiKey.trim();
  if (!normalized) return 'missing';

  const visiblePartLength = Math.max(2, Math.floor(PROVIDER_DEBUG_KEY_FINGERPRINT_LENGTH / 3));
  if (normalized.length <= visiblePartLength * 2) {
    return `${normalized.slice(0, 2)}...${normalized.slice(-2)}`;
  }

  return `${normalized.slice(0, visiblePartLength)}...${normalized.slice(-visiblePartLength)}`;
}

function sanitizeProviderBodySnippet(rawBody: string): string | null {
  if (!rawBody) return null;
  const normalized = rawBody.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.slice(0, PROVIDER_ERROR_BODY_LOG_LIMIT);
}

function parseProviderErrorPayload(rawBody: string): {
  providerErrorCode: string | null;
  providerErrorType: string | null;
  providerErrorParam: string | null;
  providerErrorMessage: string | null;
  providerBodySnippet: string | null;
} {
  const normalizedBody = rawBody.trim();
  const providerBodySnippet = SHOULD_INCLUDE_PROVIDER_ERROR_BODY
    ? sanitizeProviderBodySnippet(rawBody)
    : null;
  const hasCreditRestrictionFragment = normalizedBody
    .toLowerCase()
    .includes(PROVIDER_CREDIT_RESTRICTION_MESSAGE_FRAGMENT);

  if (!normalizedBody) {
    return {
      providerErrorCode: null,
      providerErrorType: null,
      providerErrorParam: null,
      providerErrorMessage: null,
      providerBodySnippet,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return {
      providerErrorCode: null,
      providerErrorType: null,
      providerErrorParam: null,
      providerErrorMessage: hasCreditRestrictionFragment
        ? PROVIDER_CREDIT_RESTRICTION_MESSAGE_FRAGMENT
        : providerBodySnippet,
      providerBodySnippet,
    };
  }

  const payload = toRecord(parsed);
  const nestedError = toRecord(payload?.error);
  const source = nestedError || payload;

  return {
    providerErrorCode: readStringField(source, 'code'),
    providerErrorType: readStringField(source, 'type'),
    providerErrorParam: readStringField(source, 'param'),
    providerErrorMessage:
      readStringField(source, 'message') ||
      readStringField(payload, 'error') ||
      (hasCreditRestrictionFragment
        ? PROVIDER_CREDIT_RESTRICTION_MESSAGE_FRAGMENT
        : providerBodySnippet),
    providerBodySnippet,
  };
}

function hasProviderCreditRestriction(params: {
  type: string | null;
  message: string | null;
  snippet: string | null;
}): boolean {
  const providerType = (params.type ?? '').toLowerCase();
  const providerMessage = (params.message ?? '').toLowerCase();
  const providerSnippet = (params.snippet ?? '').toLowerCase();

  return (
    providerType === PROVIDER_ERROR_TYPE_NO_PROVIDERS_AVAILABLE ||
    providerMessage.includes(PROVIDER_CREDIT_RESTRICTION_MESSAGE_FRAGMENT) ||
    providerSnippet.includes(PROVIDER_CREDIT_RESTRICTION_MESSAGE_FRAGMENT)
  );
}

export function isProviderCreditRestrictionError(
  providerStatus?: number,
  providerDebug?: Record<string, unknown>,
): boolean {
  if (providerStatus !== 403) return false;

  return hasProviderCreditRestriction({
    type: readStringField(providerDebug ?? null, 'providerErrorType'),
    message: readStringField(providerDebug ?? null, 'providerErrorMessage'),
    snippet: readStringField(providerDebug ?? null, 'providerBodySnippet'),
  });
}

function parseAiModelFallbackCandidates(): string[] {
  const raw = readCleanEnv('AI_MODEL_FALLBACKS') || DEFAULT_AI_MODEL_FALLBACKS;
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function resolveAiGatewayFallbackModel(primaryModel: string): string | null {
  if (!primaryModel.startsWith(GEMINI_31_MODEL_PREFIX)) return null;
  const candidates = parseAiModelFallbackCandidates();
  for (const candidate of candidates) {
    if (candidate !== primaryModel) {
      return candidate;
    }
  }
  return null;
}

function shouldRetryWithModelFallback(params: {
  aiHostname: string;
  providerStatus: number;
  parsedProviderError: {
    providerErrorType: string | null;
    providerErrorMessage: string | null;
    providerBodySnippet: string | null;
  };
}): boolean {
  if (params.aiHostname !== 'ai-gateway.vercel.sh') return false;
  if (params.providerStatus !== 403) return false;

  return hasProviderCreditRestriction({
    type: params.parsedProviderError.providerErrorType,
    message: params.parsedProviderError.providerErrorMessage,
    snippet: params.parsedProviderError.providerBodySnippet,
  });
}

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type PromptFileInput = {
  base64: string;
  mimeType: string;
};

export type AIUsageStats = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  reasoningTokens: number | null;
};

export type AICompletionResult = {
  content: string;
  usage: AIUsageStats | null;
};

type ProviderFailureError = Error & {
  isProviderFailure: true;
  providerStatus: number;
  providerRequestId?: string | null;
  providerDebug: Record<string, unknown>;
};

export type CallAIMeta = {
  operation: string;
  requestId: string;
};

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

function resolveRetryDelayMs(response: Response | null): number {
  const retryAfterSeconds = Number(response?.headers.get('retry-after'));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(AI_PROVIDER_MAX_RETRY_DELAY_MS, retryAfterSeconds * 1000);
  }
  return AI_PROVIDER_RETRY_DELAY_MS;
}

function resolveReasoningEffort(operation: string): string | null {
  const raw = FAST_REASONING_OPERATIONS.has(operation)
    ? readCleanEnv('AI_REASONING_EFFORT_FAST') || readCleanEnv('AI_REASONING_EFFORT')
    : readCleanEnv('AI_REASONING_EFFORT');
  const effort = raw.toLowerCase();
  return REASONING_EFFORT_VALUES.has(effort) ? effort : null;
}

export async function callAI(
  cfg: AIConfig,
  prompt: string,
  fileBase64?: string,
  fileMimeType?: string,
  additionalFiles: PromptFileInput[] = [],
  language: SupportedLanguage = 'tr',
  responseFormat?: Record<string, unknown>,
  meta: CallAIMeta = { operation: 'UNKNOWN', requestId: '' },
): Promise<AICompletionResult> {
  const content: ContentPart[] = [];

  if (fileBase64 && fileMimeType) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${fileMimeType};base64,${fileBase64}` },
    });
  }

  for (const file of additionalFiles) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${file.mimeType};base64,${file.base64}` },
    });
  }

  content.push({
    type: 'text',
    text: `${prompt}\n\n${pickLocalized(
      language,
      'ÖNEMLİ: Yanıtını yalnızca geçerli JSON olarak ver, başka hiçbir metin ekleme.',
      'IMPORTANT: Respond with valid JSON only. Do not include any extra text.',
    )}`,
  });

  const { href: validatedBaseUrl, hostname: aiHostname } = resolveAiBaseUrl(cfg.baseUrl);
  const requestStartedAt = Date.now();
  const deadline = requestStartedAt + AI_PROVIDER_TOTAL_BUDGET_MS;
  const endpoint = `${validatedBaseUrl}/chat/completions`;
  const isVercelGateway = aiHostname === 'ai-gateway.vercel.sh';
  const isGoogleDirect = aiHostname === 'generativelanguage.googleapis.com';
  const effectiveResponseFormat = responseFormat && isStructuredOutputEnabled() ? responseFormat : undefined;
  const responseFormatApplied = Boolean(effectiveResponseFormat) || (!isVercelGateway && !isGoogleDirect);
  const reasoningEffort = resolveReasoningEffort(meta.operation);
  const fallbackModel = resolveAiGatewayFallbackModel(cfg.model);
  const attemptedModels: string[] = [];

  const buildRequestBody = (model: string): Record<string, unknown> => {
    const requestBody: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content }],
    };
    if (effectiveResponseFormat) {
      requestBody.response_format = effectiveResponseFormat;
    } else if (responseFormatApplied) {
      requestBody.response_format = { type: 'json_object' };
    }
    if (reasoningEffort) {
      requestBody.reasoning_effort = reasoningEffort;
    }
    // Let the gateway fail over inside the same round-trip instead of us paying a second one.
    if (isVercelGateway && fallbackModel && fallbackModel !== model) {
      requestBody.models = [fallbackModel];
    }
    return requestBody;
  };

  const buildProviderDebugBase = (model: string) => ({
    aiHostname,
    endpoint,
    model,
    operation: meta.operation,
    hasPrimaryFile: Boolean(fileBase64 && fileMimeType),
    additionalFileCount: additionalFiles.length,
    promptLength: prompt.length,
    responseFormatApplied,
    reasoningEffort,
    apiKeyFingerprint: fingerprintApiKey(cfg.apiKey),
  });

  const executeProviderRequest = async (model: string): Promise<Response> => {
    attemptedModels.push(model);
    const requestBodyJson = JSON.stringify(buildRequestBody(model));
    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: requestBodyJson,
      signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
    });
  };

  const parseFailedProviderResponse = async (response: Response) => {
    const providerRequestId =
      response.headers.get('x-request-id') ||
      response.headers.get('request-id') ||
      response.headers.get('x-correlation-id') ||
      response.headers.get('x-vercel-ai-gateway-request-id') ||
      response.headers.get('x-vercel-id') ||
      null;

    let providerRawBody = '';
    try {
      providerRawBody = await response.text();
    } catch {
      providerRawBody = '';
    }

    return {
      providerRequestId,
      parsedProviderError: parseProviderErrorPayload(providerRawBody),
    };
  };

  const buildProviderFailureError = (params: {
    response: Response;
    modelUsed: string;
    providerRequestId: string | null;
    parsedProviderError: {
      providerErrorCode: string | null;
      providerErrorType: string | null;
      providerErrorParam: string | null;
      providerErrorMessage: string | null;
      providerBodySnippet: string | null;
    };
  }): ProviderFailureError => {
    const statusLabel = params.parsedProviderError.providerErrorMessage
      ? `AI API ${params.response.status}: ${params.parsedProviderError.providerErrorMessage}`
      : `AI API ${params.response.status}`;

    const providerError = new Error(
      params.providerRequestId
        ? `${statusLabel} (requestId: ${params.providerRequestId})`
        : statusLabel,
    ) as ProviderFailureError;

    providerError.isProviderFailure = true;
    providerError.providerStatus = params.response.status;
    providerError.providerRequestId = params.providerRequestId;
    providerError.providerDebug = {
      ...buildProviderDebugBase(params.modelUsed),
      durationMs: Date.now() - requestStartedAt,
      failureStage: 'provider-response',
      providerStatus: params.response.status,
      providerRequestId: params.providerRequestId,
      providerRetryAfter: params.response.headers.get('retry-after') || null,
      providerServer: params.response.headers.get('server') || null,
      providerVia: params.response.headers.get('via') || null,
      providerCfRay: params.response.headers.get('cf-ray') || null,
      providerXVercelId: params.response.headers.get('x-vercel-id') || null,
      attemptedModels: [...attemptedModels],
      fallbackAttempted: attemptedModels.length > 1,
      fallbackModel,
      primaryModel: cfg.model,
      ...params.parsedProviderError,
    };

    return providerError;
  };

  const buildNetworkFailureError = (error: unknown, modelUsed: string): ProviderFailureError => {
    const timedOut = isAbortError(error);
    const providerError = new Error(
      timedOut
        ? `AI provider timed out after ${Date.now() - requestStartedAt}ms`
        : `AI provider network error: ${error instanceof Error ? error.message : 'unknown'}`,
    ) as ProviderFailureError;
    providerError.isProviderFailure = true;
    providerError.providerStatus = timedOut ? 504 : 0;
    providerError.providerDebug = {
      ...buildProviderDebugBase(modelUsed),
      durationMs: Date.now() - requestStartedAt,
      failureStage: timedOut ? 'timeout' : 'network',
      attemptedModels: [...attemptedModels],
      fallbackAttempted: attemptedModels.length > 1,
      fallbackModel,
      primaryModel: cfg.model,
    };
    return providerError;
  };

  const hasRetryBudget = () => deadline - Date.now() > AI_PROVIDER_MIN_RETRY_BUDGET_MS;
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  let model = cfg.model;
  for (let attempt = 0; ; attempt += 1) {
    const canRetry = attempt < AI_PROVIDER_MAX_ATTEMPTS - 1 && hasRetryBudget();

    let res: Response;
    try {
      res = await executeProviderRequest(model);
    } catch (error) {
      // Timeouts are not retried: the budget is already spent and the client is waiting.
      if (canRetry && !isAbortError(error)) {
        model = fallbackModel ?? model;
        await sleep(AI_PROVIDER_RETRY_DELAY_MS);
        continue;
      }
      throw buildNetworkFailureError(error, model);
    }

    if (!res.ok) {
      const failure = await parseFailedProviderResponse(res);
      const isCreditRestricted = shouldRetryWithModelFallback({
        aiHostname,
        providerStatus: res.status,
        parsedProviderError: failure.parsedProviderError,
      });
      const isTransient = RETRYABLE_PROVIDER_STATUSES.has(res.status);

      if (canRetry && ((isCreditRestricted && fallbackModel && fallbackModel !== model) || isTransient)) {
        if (isTransient) await sleep(resolveRetryDelayMs(res));
        model = fallbackModel ?? model;
        continue;
      }

      throw buildProviderFailureError({
        response: res,
        modelUsed: model,
        providerRequestId: failure.providerRequestId,
        parsedProviderError: failure.parsedProviderError,
      });
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch (error) {
      if (canRetry) {
        model = fallbackModel ?? model;
        continue;
      }
      throw buildNetworkFailureError(error, model);
    }

    const payload = toRecord(data);
    const choices = Array.isArray(payload?.choices) ? payload.choices : [];
    const message = toRecord(toRecord(choices[0])?.message);
    const messageContent = typeof message?.content === 'string' ? message.content : '';
    const usage = parseUsageFromAiResponse(data);

    logServerInfo('api.ai-generate.usage', {
      requestId: meta.requestId,
      operation: meta.operation,
      model: typeof payload?.model === 'string' ? payload.model : model,
      attempts: attemptedModels.length,
      durationMs: Date.now() - requestStartedAt,
      promptTokens: usage?.promptTokens ?? null,
      completionTokens: usage?.completionTokens ?? null,
      reasoningTokens: usage?.reasoningTokens ?? null,
      totalTokens: usage?.totalTokens ?? null,
      imageCount: additionalFiles.length + (fileBase64 ? 1 : 0),
      structuredOutput: Boolean(effectiveResponseFormat),
    });

    return {
      content: messageContent || '{}',
      usage,
    };
  }
}

function toFiniteInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.floor(value));
}

export function parseUsageFromAiResponse(data: unknown): AIUsageStats | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;
  const usage = payload.usage && typeof payload.usage === 'object'
    ? (payload.usage as Record<string, unknown>)
    : null;

  if (!usage) return null;

  const promptTokens =
    toFiniteInteger(usage.prompt_tokens) ??
    toFiniteInteger(usage.input_tokens) ??
    toFiniteInteger(usage.promptTokenCount) ??
    null;

  const completionTokens =
    toFiniteInteger(usage.completion_tokens) ??
    toFiniteInteger(usage.output_tokens) ??
    toFiniteInteger(usage.candidatesTokenCount) ??
    null;

  const explicitTotal =
    toFiniteInteger(usage.total_tokens) ??
    toFiniteInteger(usage.totalTokenCount) ??
    null;

  const completionDetails =
    usage.completion_tokens_details && typeof usage.completion_tokens_details === 'object'
      ? (usage.completion_tokens_details as Record<string, unknown>)
      : null;
  const reasoningTokens =
    toFiniteInteger(completionDetails?.reasoning_tokens) ??
    toFiniteInteger(usage.reasoning_tokens) ??
    null;

  const totalTokens =
    explicitTotal ??
    (promptTokens !== null && completionTokens !== null
      ? promptTokens + completionTokens
      : null);

  const hasAnyValue =
    promptTokens !== null || completionTokens !== null || totalTokens !== null || reasoningTokens !== null;

  return hasAnyValue
    ? {
      promptTokens,
      completionTokens,
      totalTokens,
      reasoningTokens,
    }
    : null;
}
