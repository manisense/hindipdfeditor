export const AI_API_VERSION = 1 as const;

export const TRANSLATION_DIRECTIONS = ["hi-en", "en-hi"] as const;
export type TranslationDirection = (typeof TRANSLATION_DIRECTIONS)[number];

export const TRANSLATION_STATUSES = [
  "translated",
  "skipped",
  "failed",
] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export const AI_ERROR_CODES = [
  "BAD_REQUEST",
  "CONSENT_REQUIRED",
  "FORBIDDEN",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "QUOTA_EXHAUSTED",
  "INVALID_OUTPUT",
  "TEMPORARILY_UNAVAILABLE",
  "FEATURE_DISABLED",
  "INTERNAL_ERROR",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];

export const AI_LIMITS = {
  maxDocumentBytes: 40 * 1024 * 1024,
  maxDocumentPages: 40,
  maxLinesPerRequest: 40,
  maxLineCharacters: 2_000,
  maxRequestCharacters: 32_000,
  maxOcrImageBytes: 8 * 1024 * 1024,
  anonymousDocumentsPerDay: 2,
  anonymousPagesPerDay: 50,
} as const;

export type TranslationLine = {
  id: string;
  page: number;
  text: string;
  block?: string;
  contextBefore?: string;
  contextAfter?: string;
};

export type TranslationRequest = {
  version: typeof AI_API_VERSION;
  requestId: string;
  direction: TranslationDirection;
  lines: TranslationLine[];
};

export type TranslationResult = {
  id: string;
  translatedText: string | null;
  status: TranslationStatus;
  reason?: string;
};

export type TranslationResponse = {
  version: typeof AI_API_VERSION;
  requestId: string;
  model: string;
  results: TranslationResult[];
};

export type OcrLineResult = {
  text: string;
  box_2d: [number, number, number, number];
};

export type OcrResponse = {
  version: typeof AI_API_VERSION;
  requestId: string;
  model: string;
  lines: OcrLineResult[];
};

export type CapabilitiesResponse = {
  version: typeof AI_API_VERSION;
  translation: {
    enabled: boolean;
    directions: TranslationDirection[];
  };
  aiOcr: {
    enabled: boolean;
    requiresConsent: true;
  };
  limits: typeof AI_LIMITS;
};

export type AiErrorResponse = {
  version: typeof AI_API_VERSION;
  requestId: string;
  error: {
    code: AiErrorCode;
    message: string;
    retryable: boolean;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${key} must be a non-empty string`);
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string")
    throw new Error(`${key} must be a string when provided`);
  return value;
}

/** Returns true when `value` is a supported translation direction. */
export function isTranslationDirection(
  value: unknown,
): value is TranslationDirection {
  return (
    typeof value === "string" &&
    TRANSLATION_DIRECTIONS.includes(value as TranslationDirection)
  );
}

/** Returns the source language code for a translation direction. */
export function sourceLanguage(direction: TranslationDirection): "hi" | "en" {
  return direction === "hi-en" ? "hi" : "en";
}

/** Returns the target language code for a translation direction. */
export function targetLanguage(direction: TranslationDirection): "hi" | "en" {
  return direction === "hi-en" ? "en" : "hi";
}

/** Parses and validates an untrusted translation request. */
export function parseTranslationRequest(value: unknown): TranslationRequest {
  if (!isRecord(value)) throw new Error("request must be an object");
  if (value.version !== AI_API_VERSION)
    throw new Error("unsupported API version");
  const requestId = requiredString(value, "requestId");
  if (!isTranslationDirection(value.direction)) {
    throw new Error("direction must be hi-en or en-hi");
  }
  if (!Array.isArray(value.lines) || value.lines.length === 0) {
    throw new Error("lines must be a non-empty array");
  }
  if (value.lines.length > AI_LIMITS.maxLinesPerRequest) {
    throw new Error(
      `lines exceeds the ${AI_LIMITS.maxLinesPerRequest} line limit`,
    );
  }

  const seenIds = new Set<string>();
  let totalCharacters = 0;
  const lines = value.lines.map((entry, index): TranslationLine => {
    if (!isRecord(entry)) throw new Error(`lines[${index}] must be an object`);
    const id = requiredString(entry, "id");
    if (seenIds.has(id)) throw new Error(`duplicate line id: ${id}`);
    seenIds.add(id);
    const text = requiredString(entry, "text");
    if (text.length > AI_LIMITS.maxLineCharacters) {
      throw new Error(`line ${id} exceeds the character limit`);
    }
    totalCharacters += text.length;
    if (!Number.isInteger(entry.page) || (entry.page as number) < 0) {
      throw new Error(`line ${id} page must be a non-negative integer`);
    }
    return {
      id,
      page: entry.page as number,
      text,
      ...(optionalString(entry, "block") !== undefined
        ? { block: optionalString(entry, "block") }
        : {}),
      ...(optionalString(entry, "contextBefore") !== undefined
        ? { contextBefore: optionalString(entry, "contextBefore") }
        : {}),
      ...(optionalString(entry, "contextAfter") !== undefined
        ? { contextAfter: optionalString(entry, "contextAfter") }
        : {}),
    };
  });
  if (totalCharacters > AI_LIMITS.maxRequestCharacters) {
    throw new Error(
      `request exceeds the ${AI_LIMITS.maxRequestCharacters} character limit`,
    );
  }
  return {
    version: AI_API_VERSION,
    requestId,
    direction: value.direction,
    lines,
  };
}

/** Parses a translation response and verifies that it mirrors every expected line ID once. */
export function parseTranslationResponse(
  value: unknown,
  expectedRequest: TranslationRequest,
): TranslationResponse {
  if (!isRecord(value)) throw new Error("response must be an object");
  if (value.version !== AI_API_VERSION)
    throw new Error("unsupported API version");
  const requestId = requiredString(value, "requestId");
  if (requestId !== expectedRequest.requestId)
    throw new Error("response requestId mismatch");
  const model = requiredString(value, "model");
  if (!Array.isArray(value.results))
    throw new Error("results must be an array");
  if (value.results.length !== expectedRequest.lines.length) {
    throw new Error("response result count mismatch");
  }

  const expectedIds = new Set(expectedRequest.lines.map((line) => line.id));
  const seenIds = new Set<string>();
  const results = value.results.map((entry, index): TranslationResult => {
    if (!isRecord(entry))
      throw new Error(`results[${index}] must be an object`);
    const id = requiredString(entry, "id");
    if (!expectedIds.has(id)) throw new Error(`unexpected result id: ${id}`);
    if (seenIds.has(id)) throw new Error(`duplicate result id: ${id}`);
    seenIds.add(id);
    if (
      typeof entry.status !== "string" ||
      !TRANSLATION_STATUSES.includes(entry.status as TranslationStatus)
    ) {
      throw new Error(`result ${id} has an invalid status`);
    }
    const translatedText = entry.translatedText;
    if (translatedText !== null && typeof translatedText !== "string") {
      throw new Error(`result ${id} translatedText must be a string or null`);
    }
    if (
      entry.status === "translated" &&
      (translatedText === null || translatedText.trim() === "")
    ) {
      throw new Error(`translated result ${id} must contain text`);
    }
    if (entry.status !== "translated" && translatedText !== null) {
      throw new Error(`non-translated result ${id} must contain null text`);
    }
    const reason = optionalString(entry, "reason");
    return {
      id,
      translatedText,
      status: entry.status as TranslationStatus,
      ...(reason !== undefined ? { reason } : {}),
    };
  });

  for (const expectedId of expectedIds) {
    if (!seenIds.has(expectedId))
      throw new Error(`missing result id: ${expectedId}`);
  }
  return { version: AI_API_VERSION, requestId, model, results };
}
