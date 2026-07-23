import type { AiErrorCode } from "@hindipdfeditor/translation-contract";

export class ApiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    code: AiErrorCode,
    message: string,
    status: number,
    retryable = false,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function asApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof SyntaxError) {
    return new ApiError("BAD_REQUEST", "Request body must be valid JSON.", 400);
  }
  return new ApiError(
    "INTERNAL_ERROR",
    "The AI service could not complete the request.",
    500,
    true,
  );
}
