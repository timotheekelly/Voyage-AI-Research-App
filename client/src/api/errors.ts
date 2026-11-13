export type ApiErrorType =
  | "NETWORK_ERROR"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SERVER_ERROR"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export class ApiError extends Error {
  constructor(
    public type: ApiErrorType,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const ERROR_MESSAGES: Record<ApiErrorType, string> = {
  NETWORK_ERROR: "Unable to connect to the research API. Check that the backend is running.",
  NOT_FOUND: "This feature is not available in the selected API version yet.",
  METHOD_NOT_ALLOWED: "This operation is not supported by the current API.",
  UNAUTHORIZED: "You need to sign in to access this. Please sign in and try again.",
  FORBIDDEN: "You don't have access to this resource.",
  SERVER_ERROR: "The research service encountered an error. Please try again.",
  TIMEOUT: "The request took too long. Please try again.",
  INVALID_RESPONSE: "The API returned an unexpected response.",
  UNKNOWN: "Something went wrong. Please try again.",
};

export function createApiError(type: ApiErrorType, status?: number): ApiError {
  return new ApiError(type, ERROR_MESSAGES[type], status);
}

export function errorTypeFromStatus(status: number): ApiErrorType {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 405) return "METHOD_NOT_ALLOWED";
  if (status >= 500 && status <= 599) return "SERVER_ERROR";
  return "UNKNOWN";
}

/** User-initiated or version-invalidated cancellation (not an ApiError). */
export function isCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function createCancellation(): DOMException {
  return new DOMException("The request was cancelled.", "AbortError");
}

export function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : createApiError("UNKNOWN");
}

/** Safe, user-facing text for any thrown value. */
export function describeError(error: unknown): string {
  return ERROR_MESSAGES[toApiError(error).type];
}
