import {
  AI_API_VERSION,
  type AiErrorResponse,
  type OcrResponse,
  type SessionResponse,
  type TranslationDirection,
  type TranslationLine,
  type TranslationResponse,
} from '@hindipdfeditor/translation-contract';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

const DEFAULT_AI_API_BASE_URL = 'https://api.hindipdfeditor.com';
const CLIENT_ID_FILE = 'ai-client-id.txt';
const REQUEST_TIMEOUT_MS = 35_000;

type FetchLike = typeof fetch;

export type AiApiClientOptions = {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  clientIdProvider?: () => Promise<string>;
};

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

function publicError(value: unknown, status: number): Error {
  const body = value as Partial<AiErrorResponse>;
  const message = body.error?.message;
  if (typeof message === 'string' && message.trim() !== '') return new Error(message);
  return new Error(`AI service request failed (HTTP ${status}).`);
}

/** Creates the production AI API client; all request timeouts are in milliseconds. */
export function createAiApiClient(options: AiApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? DEFAULT_AI_API_BASE_URL).replace(/\/$/u, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  const clientIdProvider = options.clientIdProvider ?? getOrCreateClientId;
  let session: SessionResponse | null = null;

  async function post<T>(path: string, body: unknown, retrySession = true): Promise<T> {
    if (path !== '/v1/session') {
      const expiresAt = session ? Date.parse(session.expiresAt) : 0;
      if (!session || expiresAt <= Date.now() + 60_000) {
        session = await post<SessionResponse>('/v1/session', {
          version: AI_API_VERSION,
          clientId: await clientIdProvider(),
          platform: 'android',
        });
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
      if (response.ok) return json as T;
      if (response.status === 401 && path !== '/v1/session' && retrySession) {
        session = null;
        return post<T>(path, body, false);
      }
      throw publicError(json, response.status);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('The AI service timed out. Please retry.');
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
      return post('/v1/translate', {
        version: AI_API_VERSION,
        requestId: Crypto.randomUUID(),
        jobId,
        direction,
        lines,
      });
    },

    async ocr(input: OcrPageInput): Promise<OcrResponse> {
      return post('/v1/ocr', {
        version: AI_API_VERSION,
        requestId: Crypto.randomUUID(),
        consent: true,
        ...input,
      });
    },
  };
}

export const aiApiClient = createAiApiClient();
