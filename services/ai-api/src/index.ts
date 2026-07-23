import {
  AI_API_VERSION,
  AI_LIMITS,
  TRANSLATION_DIRECTIONS,
  parseTranslationRequest,
  type AiErrorResponse,
  type CapabilitiesResponse,
  type OcrRequest,
  type SessionRequest,
  type SessionResponse,
} from "@hindipdfeditor/translation-contract";

import type { Env } from "./env";
import { ApiError, asApiError } from "./errors";
import { ocrWithGemini, translateWithGemini } from "./gemini";
import { D1QuotaStore, type QuotaStore } from "./quota";
import { createSession, verifySession } from "./session";
import { verifyTurnstile } from "./turnstile";

export type AppDependencies = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  quotaStore?: QuotaStore;
};

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = new Set(
    env.ALLOWED_ORIGINS.split(",").map((value) => value.trim()),
  );
  return allowed.has(origin) ? origin : null;
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({ Vary: "Origin" });
  const origin = allowedOrigin(request, env);
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Max-Age", "86400");
  }
  return headers;
}

function jsonResponse(
  request: Request,
  env: Env,
  value: unknown,
  status = 200,
): Response {
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(JSON.stringify(value), { status, headers });
}

async function readJson(request: Request): Promise<unknown> {
  if (
    !request.headers
      .get("Content-Type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new ApiError(
      "BAD_REQUEST",
      "Content-Type must be application/json.",
      415,
    );
  }
  return request.json();
}

function requestIdFrom(value: unknown): string {
  if (typeof value === "object" && value !== null && "requestId" in value) {
    const requestId = (value as { requestId?: unknown }).requestId;
    if (typeof requestId === "string" && requestId.trim() !== "")
      return requestId;
  }
  return crypto.randomUUID();
}

function parseOcrRequest(value: unknown): OcrRequest {
  if (typeof value !== "object" || value === null)
    throw new Error("request must be an object");
  const request = value as Partial<OcrRequest>;
  if (
    request.version !== AI_API_VERSION ||
    typeof request.requestId !== "string" ||
    request.requestId.trim() === "" ||
    typeof request.jobId !== "string" ||
    request.jobId.trim() === "" ||
    !Number.isInteger(request.page) ||
    (request.page ?? -1) < 0 ||
    request.consent !== true ||
    typeof request.imageBase64 !== "string" ||
    !["image/jpeg", "image/png", "image/webp"].includes(
      request.mimeType ?? "",
    ) ||
    !Number.isFinite(request.imagePxWidth) ||
    !Number.isFinite(request.imagePxHeight) ||
    (request.imagePxWidth ?? 0) <= 0 ||
    (request.imagePxHeight ?? 0) <= 0
  ) {
    throw new Error("invalid OCR request");
  }
  const estimatedBytes = Math.floor((request.imageBase64.length * 3) / 4);
  if (estimatedBytes > AI_LIMITS.maxOcrImageBytes) {
    throw new ApiError(
      "PAYLOAD_TOO_LARGE",
      "The OCR page image exceeds the 8 MB limit.",
      413,
    );
  }
  return request as OcrRequest;
}

function usageDay(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

async function authenticateAndLimit(
  request: Request,
  env: Env,
  nowMs: number,
): Promise<{ actorId: string; platform: "android" | "web" }> {
  const session = await verifySession(
    request.headers.get("Authorization"),
    env.SESSION_SIGNING_SECRET,
    nowMs,
  );
  const rate = await env.AI_RATE_LIMITER.limit({ key: session.actorId });
  if (!rate.success)
    throw new ApiError(
      "RATE_LIMITED",
      "Too many AI requests. Please wait and retry.",
      429,
      true,
    );
  return session;
}

function writeMetric(
  env: Env,
  route: string,
  status: number,
  startedAt: number,
  units: number,
): void {
  env.AI_ANALYTICS?.writeDataPoint({
    blobs: [route, String(status)],
    doubles: [Date.now() - startedAt, units],
    indexes: [route],
  });
}

export async function handleRequest(
  request: Request,
  env: Env,
  _context?: ExecutionContext,
  dependencies: AppDependencies = {},
): Promise<Response> {
  const startedAt = Date.now();
  const now = dependencies.now?.() ?? Date.now();
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const quotaStore = dependencies.quotaStore ?? new D1QuotaStore(env.AI_DB);
  const url = new URL(request.url);
  let requestId: string = crypto.randomUUID();
  try {
    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigin(request, env)) {
      throw new ApiError("FORBIDDEN", "This web origin is not allowed.", 403);
    }
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });

    if (request.method === "GET" && url.pathname === "/v1/capabilities") {
      const body: CapabilitiesResponse = {
        version: AI_API_VERSION,
        translation: {
          enabled: env.AI_TRANSLATION_ENABLED === "true",
          directions: [...TRANSLATION_DIRECTIONS],
        },
        aiOcr: {
          enabled: env.AI_OCR_ENABLED === "true",
          requiresConsent: true,
        },
        limits: AI_LIMITS,
      };
      const response = jsonResponse(request, env, body);
      writeMetric(env, "capabilities", response.status, startedAt, 0);
      return response;
    }

    if (request.method === "POST" && url.pathname === "/v1/session") {
      const value = await readJson(request);
      const sessionRequest = value as Partial<SessionRequest>;
      if (
        sessionRequest.version !== AI_API_VERSION ||
        typeof sessionRequest.clientId !== "string" ||
        sessionRequest.clientId.length < 16 ||
        sessionRequest.clientId.length > 128 ||
        (sessionRequest.platform !== "android" &&
          sessionRequest.platform !== "web")
      ) {
        throw new ApiError(
          "BAD_REQUEST",
          "The AI session request is invalid.",
          400,
        );
      }
      if (sessionRequest.platform === "web") {
        await verifyTurnstile(
          sessionRequest.turnstileToken,
          request,
          env,
          fetchImpl,
        );
      }
      const session = await createSession(
        sessionRequest.clientId,
        sessionRequest.platform,
        env.SESSION_SIGNING_SECRET,
        now,
      );
      const body: SessionResponse = { version: AI_API_VERSION, ...session };
      const response = jsonResponse(request, env, body);
      writeMetric(env, "session", response.status, startedAt, 0);
      return response;
    }

    if (request.method === "POST" && url.pathname === "/v1/translate") {
      if (env.AI_TRANSLATION_ENABLED !== "true") {
        throw new ApiError(
          "FEATURE_DISABLED",
          "AI translation is temporarily unavailable.",
          503,
          true,
        );
      }
      const value = await readJson(request);
      requestId = requestIdFrom(value);
      let translationRequest;
      try {
        translationRequest = parseTranslationRequest(value);
      } catch (error) {
        throw new ApiError(
          "BAD_REQUEST",
          error instanceof Error
            ? error.message
            : "Invalid translation request.",
          400,
        );
      }
      const session = await authenticateAndLimit(request, env, now);
      await quotaStore.reserve(
        session.actorId,
        usageDay(now),
        translationRequest.jobId,
        translationRequest.lines.map((line) => line.page),
      );
      const body = await translateWithGemini(
        translationRequest,
        env,
        fetchImpl,
      );
      const response = jsonResponse(request, env, body);
      writeMetric(
        env,
        "translate",
        response.status,
        startedAt,
        translationRequest.lines.length,
      );
      return response;
    }

    if (request.method === "POST" && url.pathname === "/v1/ocr") {
      if (env.AI_OCR_ENABLED !== "true") {
        throw new ApiError(
          "FEATURE_DISABLED",
          "AI OCR is temporarily unavailable.",
          503,
          true,
        );
      }
      const contentLength = Number(request.headers.get("Content-Length") ?? 0);
      if (
        contentLength >
        Math.ceil((AI_LIMITS.maxOcrImageBytes * 4) / 3) + 100_000
      ) {
        throw new ApiError(
          "PAYLOAD_TOO_LARGE",
          "The OCR request exceeds the allowed size.",
          413,
        );
      }
      const value = await readJson(request);
      requestId = requestIdFrom(value);
      let ocrRequest: OcrRequest;
      try {
        ocrRequest = parseOcrRequest(value);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          "BAD_REQUEST",
          "The AI OCR request is invalid.",
          400,
        );
      }
      const session = await authenticateAndLimit(request, env, now);
      await quotaStore.reserve(
        session.actorId,
        usageDay(now),
        ocrRequest.jobId,
        [ocrRequest.page],
      );
      const body = await ocrWithGemini(ocrRequest, env, fetchImpl);
      const response = jsonResponse(request, env, body);
      writeMetric(env, "ocr", response.status, startedAt, 1);
      return response;
    }

    throw new ApiError(
      "BAD_REQUEST",
      "The requested AI endpoint does not exist.",
      404,
    );
  } catch (error) {
    const apiError = asApiError(error);
    const body: AiErrorResponse = {
      version: AI_API_VERSION,
      requestId,
      error: {
        code: apiError.code,
        message: apiError.message,
        retryable: apiError.retryable,
      },
    };
    const response = jsonResponse(request, env, body, apiError.status);
    writeMetric(env, url.pathname, response.status, startedAt, 0);
    return response;
  }
}

export default { fetch: handleRequest } satisfies ExportedHandler<Env>;
