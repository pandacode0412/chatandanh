export const errorCodes = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "SESSION_EXPIRED",
  "MATCHING_ALREADY_IN_QUEUE",
  "CONVERSATION_NOT_FOUND",
  "MESSAGE_TOO_LONG",
  "TARGET_BLOCKED",
  "ROOM_DISABLED",
  "PROFILE_REQUIRED"
] as const;

export type ErrorCode = (typeof errorCodes)[number];

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown[];
}

export interface ApiEnvelope<TData = unknown, TMeta = Record<string, unknown>> {
  data: TData | null;
  meta: TMeta;
  error: ApiError | null;
}

export function ok<TData, TMeta = Record<string, never>>(
  data: TData,
  meta = {} as TMeta
): ApiEnvelope<TData, TMeta> {
  return { data, meta, error: null };
}

export function fail(code: ErrorCode, message: string, details: unknown[] = []): ApiEnvelope<null> {
  return {
    data: null,
    meta: {},
    error: { code, message, details }
  };
}
