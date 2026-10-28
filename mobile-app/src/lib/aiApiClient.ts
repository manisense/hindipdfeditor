import {
  AI_API_VERSION,
  AI_LIMITS,
  parseTranslationResponse,
  type AiErrorCode,
  type AiErrorResponse,
  type OcrRequest,
  type OcrResponse,
  type SessionResponse,
  type TranslationDirection,
  type TranslationLine,
  type TranslationRequest,
  type TranslationResponse,
} from '@hindipdfeditor/translation-contract';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

const DEFAULT_AI_API_BASE_URL = 'https://api.hindipdfeditor.com';
const CLIENT_ID_FILE = 'ai-client-id.txt';
const REQUEST_TIMEOUT_MS = 35_000;
/** Waits before each retry of a retryable API error, in milliseconds. */
const DEFAULT_RETRY_DELAYS_MS = [2_000, 5_000];

type FetchLike = typeof fetch;

export type AiApiClientOptions = {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  clientIdProvider?: () => Promise<string>;
  /** Waits before each retry of a retryable API error, in milliseconds. */
  retryDelaysMs?: readonly number[];
};

/** Why an AI request failed: an API error code, or a failure before any response arrived. */
export type AiFailureCode = AiErrorCode | 'NETWORK' | 'TIMEOUT';

/** A failed AI request; `code` tells a quota stop apart from a network failure. */
export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly code: AiFailureCode,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'AiServiceError';
  }
}

export type OcrPageInput = {
  jobId: string;
  page: number;
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  imagePxWidth: number;
  imagePxHeight: number;
};

function clientIdUri(): string {
  if (!FileSystem.documentDirectory) throw new Error('App storage is unavailable.');
  return `${FileSystem.documentDirectory}${CLIENT_ID_FILE}`;
}

async function getOrCreateClientId(): Promise<string> {
  const uri = clientIdUri();
  try {
    const existing = (await FileSystem.readAsStringAsync(uri)).trim();
    if (existing.length >= 16 && existing.length <= 128) return existing;
  } catch {
    // A missing or unreadable identity file is replaced below with a new anonymous ID.
  }
  const clientId = `android-${Crypto.randomUUID()}`;
  await FileSystem.writeAsStringAsync(uri, clientId);
  return clientId;
}

function publicError(value: unknown, status: number): AiServiceError {
  const body = isRecord(value) ? (value as Partial<AiErrorResponse>) : null;
  const message = body?.error?.message;
  const code = body?.error?.code;
  return new AiServiceError(
    typeof message === 'string' && message.trim() !== ''
      ? message
      : `AI service request failed (HTTP ${status}).`,
    typeof code === 'string' ? code : 'INTERNAL_ERROR',
    body?.error?.retryable === true,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const entry = value[key];
  if (typeof entry !== 'string' || entry.trim() === '') {
    throw new Error(`AI service returned an invalid ${key}.`);
  }
  return entry;
}

function parseSessionResponse(value: unknown): SessionResponse {
  if (!isRecord(value) || value.version !== AI_API_VERSION) {
    throw new Error('AI service returned an invalid session response.');
  }
  const token = requiredString(value, 'token');
  const expiresAt = requiredString(value, 'expiresAt');
  if (!Number.isFinite(Date.parse(expiresAt))) {
    throw new Error('AI service returned an invalid session expiry.');
  }
  return { version: AI_API_VERSION, token, expiresAt };
}

function parseOcrResponse(value: unknown, expectedRequestId: string): OcrResponse {
  if (!isRecord(value) || value.version !== AI_API_VERSION) {
    throw new Error('AI service returned an invalid OCR response.');
  }
  const requestId = requiredString(value, 'requestId');
  if (requestId !== expectedRequestId) {
    throw new Error('AI OCR response requestId mismatch.');
  }
  const model = requiredString(value, 'model');
  if (!Array.isArray(value.lines)) {
    throw new Error('AI OCR response lines must be an array.');
  }
  const lines = value.lines.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`AI OCR line ${index} must be an object.`);
    const text = requiredString(entry, 'text');
    if (text.length > AI_LIMITS.maxLineCharacters) {
      throw new Error(`AI OCR line ${index} exceeds the text limit.`);
    }
    const box = entry.box_2d;
    if (
      !Array.isArray(box) ||
      box.length !== 4 ||
      !box.every(
        (coordinate) =>
          typeof coordinate === 'number' &&
          Number.isFinite(coordinate) &&
          coordinate >= 0 &&
          coordinate <= 1000,
      ) ||
      box[0] >= box[2] ||
      box[1] >= box[3]
    ) {
      throw new Error(`AI OCR line ${index} has an invalid bounding box.`);
    }
    return { text, box_2d: box as [number, number, number, number] };
  });
  return { version: AI_API_VERSION, requestId, model, lines };
}

/** Creates the production AI API client; all request timeouts are in milliseconds. */
export function createAiApiClient(options: AiApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? DEFAULT_AI_API_BASE_URL).replace(/\/$/u, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const clientIdProvider = options.clientIdProvider ?? getOrCreateClientId;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  let session: SessionResponse | null = null;

  /** Sends `post` again after each retryable API error, waiting `retryDelaysMs` between tries. */
  async function postWithRetry(path: string, body: unknown): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await post(path, body);
      } catch (error) {
        const delay = retryDelaysMs[attempt];
        if (!(error instanceof AiServiceError) || !error.retryable || delay === undefined) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  async function post(path: string, body: unknown, retrySession = true): Promise<unknown> {
    if (path !== '/v1/session') {
      const expiresAt = session ? Date.parse(session.expiresAt) : 0;
      if (!session || expiresAt <= Date.now() + 60_000) {
        session = parseSessionResponse(
          await post('/v1/session', {
            version: AI_API_VERSION,
            clientId: await clientIdProvider(),
            platform: 'android',
          }),
        );
      }
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(path !== '/v1/session' && session
            ? { Authorization: `Bearer ${session.token}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json: unknown = await response.json().catch(() => null);
      if (response.ok) return json;
      if (response.status === 401 && path !== '/v1/session' && retrySession) {
        session = null;
        return post(path, body, false);
      }
      throw publicError(json, response.status);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiServiceError('The AI service timed out. Please retry.', 'TIMEOUT', false);
      }
      // fetch rejects with a TypeError when no response arrives (offline, DNS, TLS).
      if (error instanceof TypeError) {
        throw new AiServiceError('The AI service could not be reached.', 'NETWORK', false);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async translate(
      jobId: string,
      direction: TranslationDirection,
      lines: TranslationLine[],
    ): Promise<TranslationResponse> {
      const request: TranslationRequest = {
        version: AI_API_VERSION,
        requestId: Crypto.randomUUID(),
        jobId,
        direction,
        lines,
      };
      return parseTranslationResponse(await postWithRetry('/v1/translate', request), request);
    },

    async ocr(input: OcrPageInput): Promise<OcrResponse> {
      const request: OcrRequest = {
        version: AI_API_VERSION,
        requestId: Crypto.randomUUID(),
        consent: true,
        ...input,
      };
      return parseOcrResponse(await postWithRetry('/v1/ocr', request), request.requestId);
    },
  };
}

export const aiApiClient = createAiApiClient();
