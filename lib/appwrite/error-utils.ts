type AppwriteResponseLike = {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  type?: unknown;
  message?: unknown;
};

type AppwriteErrorLike = {
  code?: unknown;
  status?: unknown;
  type?: unknown;
  message?: unknown;
  response?: unknown;
};

export type AppwriteErrorDetails = {
  code: number | null;
  status: number | null;
  type: string | null;
  message: string | null;
  responseCode: number | null;
  responseStatus: number | null;
  responseType: string | null;
  responseMessage: string | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
}

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toAppwriteResponseLike(value: unknown): AppwriteResponseLike | null {
  if (!value || typeof value !== 'object') return null;
  return value as AppwriteResponseLike;
}

export function getAppwriteErrorDetails(error: unknown): AppwriteErrorDetails {
  const typed = error as AppwriteErrorLike;
  const response = toAppwriteResponseLike(typed?.response);

  return {
    code: toFiniteNumber(typed?.code),
    status: toFiniteNumber(typed?.status),
    type: toTrimmedString(typed?.type),
    message: toTrimmedString(typed?.message),
    responseCode: toFiniteNumber(response?.code),
    responseStatus: toFiniteNumber(response?.status ?? response?.statusCode),
    responseType: toTrimmedString(response?.type),
    responseMessage: toTrimmedString(response?.message),
  };
}

function matchesErrorType(type: string | null, candidates: string[]): boolean {
  if (!type) return false;
  const normalized = type.trim().toLowerCase();
  return candidates.some((candidate) => normalized === candidate || normalized.includes(candidate));
}

function getResolvedStatus(details: AppwriteErrorDetails): number | null {
  return details.code ?? details.status ?? details.responseCode ?? details.responseStatus;
}

export function isAppwriteNotFound(error: unknown): boolean {
  const details = getAppwriteErrorDetails(error);
  const status = getResolvedStatus(details);

  return (
    status === 404 ||
    matchesErrorType(details.type, ['not_found', 'general_not_found', 'document_not_found']) ||
    matchesErrorType(details.responseType, ['not_found', 'general_not_found', 'document_not_found']) ||
    matchesErrorType(details.message, ['not found', 'does not exist']) ||
    matchesErrorType(details.responseMessage, ['not found', 'does not exist'])
  );
}

export function isAppwriteConflict(error: unknown): boolean {
  const details = getAppwriteErrorDetails(error);
  const status = getResolvedStatus(details);

  return (
    status === 409 ||
    matchesErrorType(details.type, ['already_exists', 'document_already_exists', 'user_already_exists']) ||
    matchesErrorType(details.responseType, ['already_exists', 'document_already_exists', 'user_already_exists']) ||
    matchesErrorType(details.message, ['already exists', 'same id', 'same email', 'same phone']) ||
    matchesErrorType(details.responseMessage, ['already exists', 'same id', 'same email', 'same phone'])
  );
}

export function isAppwriteColumnNotAvailable(error: unknown): boolean {
  const details = getAppwriteErrorDetails(error);
  const status = getResolvedStatus(details);

  return (
    status === 400 &&
    (
      matchesErrorType(details.type, ['column_not_available']) ||
      matchesErrorType(details.responseType, ['column_not_available']) ||
      matchesErrorType(details.message, ['not yet available']) ||
      matchesErrorType(details.responseMessage, ['not yet available'])
    )
  );
}