import {
  AI_API_VERSION,
  type AiErrorResponse,
  type OcrResponse,
  type SessionResponse,
  type TranslationDirection,
  type TranslationLine,
  type TranslationResponse,
} from "@hindipdfeditor/translation-contract";

const DEFAULT_BASE_URL = "https://api.hindipdfeditor.com";
const CLIENT_ID_KEY = "hpdf-anonymous-ai-client-id";
const REQUEST_TIMEOUT_MS = 35_000;

type Options = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  clientIdProvider?: () => string;
  turnstileTokenProvider?: () => string | null;
};

function browserClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing && existing.length >= 16 && existing.length <= 128)
    return existing;
  const created = `web-${crypto.randomUUID()}`;
  localStorage.setItem(CLIENT_ID_KEY, created);
  return created;
}

function apiError(value: unknown, status: number): Error {
  const body = value as Partial<AiErrorResponse>;
  return new Error(
    body.error?.message ?? `AI service request failed (HTTP ${status}).`,
  );
}

/** Creates a browser AI client; request timeout values are in milliseconds. */
export function createAiApiClient(options: Options = {}) {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/u, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const clientIdProvider = options.clientIdProvider ?? browserClientId;
  let turnstileTokenProvider = options.turnstileTokenProvider ?? (() => null);
  let session: SessionResponse | null = null;

  async function post<T>(
    path: string,
    body: unknown,
    retry = true,
  ): Promise<T> {
    if (path !== "/v1/session") {
      if (!session || Date.parse(session.expiresAt) <= Date.now() + 60_000) {
        const turnstileToken = turnstileTokenProvider();
        if (!turnstileToken)
          throw new Error("Complete the security check before using AI.");
        session = await post<SessionResponse>("/v1/session", {
          version: AI_API_VERSION,
          clientId: clientIdProvider(),
          platform: "web",
          turnstileToken,
        });
      }
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(path !== "/v1/session" && session
            ? { Authorization: `Bearer ${session.token}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json: unknown = await response.json().catch(() => null);
      if (response.ok) return json as T;
      if (response.status === 401 && path !== "/v1/session" && retry) {
        session = null;
        return post<T>(path, body, false);
      }
      throw apiError(json, response.status);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("The AI service timed out. Please retry.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  return {
    setTurnstileTokenProvider(provider: () => string | null): void {
      turnstileTokenProvider = provider;
    },
    async translate(
      jobId: string,
      direction: TranslationDirection,
      lines: TranslationLine[],
    ): Promise<TranslationResponse> {
      return post("/v1/translate", {
        version: AI_API_VERSION,
        requestId: crypto.randomUUID(),
        jobId,
        direction,
        lines,
      });
    },
    async ocr(input: {
      jobId: string;
      page: number;
      imageBase64: string;
      mimeType: "image/jpeg" | "image/png" | "image/webp";
      imagePxWidth: number;
      imagePxHeight: number;
    }): Promise<OcrResponse> {
      return post("/v1/ocr", {
        version: AI_API_VERSION,
        requestId: crypto.randomUUID(),
        consent: true,
        ...input,
      });
    },
  };
}

export const aiApiClient = createAiApiClient();
