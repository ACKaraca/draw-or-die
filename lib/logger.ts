import { getAppwriteErrorDetails } from '@/lib/appwrite/error-utils';

type LogLevel = 'error' | 'warn' | 'info';

export type ClientLogPayload = {
  scope: string;
  message: string;
  details?: unknown;
  requestId?: string;
  level?: LogLevel;
};

function normalizeError(error: unknown) {
  const appwriteDetails = getAppwriteErrorDetails(error);

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: appwriteDetails.code,
      status: appwriteDetails.status ?? appwriteDetails.responseStatus,
      type: appwriteDetails.type ?? appwriteDetails.responseType,
      responseCode: appwriteDetails.responseCode,
      responseStatus: appwriteDetails.responseStatus,
      responseType: appwriteDetails.responseType,
      responseMessage: appwriteDetails.responseMessage,
    };
  }
  return {
    message: typeof error === 'string' ? error : 'Unknown error',
    raw: error,
    code: appwriteDetails.code,
    status: appwriteDetails.status ?? appwriteDetails.responseStatus,
    type: appwriteDetails.type ?? appwriteDetails.responseType,
    responseCode: appwriteDetails.responseCode,
    responseStatus: appwriteDetails.responseStatus,
    responseType: appwriteDetails.responseType,
    responseMessage: appwriteDetails.responseMessage,
  };
}

export function logServerError(scope: string, error: unknown, details?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    scope,
    level: 'error' as const,
    error: normalizeError(error),
    details: details ?? {},
  };
  console.error('[server-error]', JSON.stringify(payload));
}

export async function reportClientError(payload: ClientLogPayload): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    await fetch('/api/client-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      keepalive: true,
      body: JSON.stringify(payload),
    });
  } catch {
    // Intentionally ignored: logging must never block UX.
  }
}
