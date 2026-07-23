import { AI_API_VERSION } from "@hindipdfeditor/translation-contract";
import { describe, expect, it, vi } from "vitest";

import type { Env } from "../src/env";
import { handleRequest } from "../src/index";
import { MemoryQuotaStore } from "../src/quota";
import { createSession } from "../src/session";

const NOW = Date.UTC(2026, 6, 22, 12, 0, 0);
const SECRET = "0123456789abcdef0123456789abcdef";

function environment(): Env {
  return {
    GEMINI_API_KEY: "gemini-secret",
    SESSION_SIGNING_SECRET: SECRET,
    TURNSTILE_SECRET_KEY: "turnstile-secret",
    GEMINI_MODEL: "gemini-3.5-flash",
    ALLOWED_ORIGINS: "https://hindipdfeditor.com",
    TURNSTILE_HOSTNAMES: "hindipdfeditor.com",
    AI_TRANSLATION_ENABLED: "true",
    AI_OCR_ENABLED: "true",
    AI_DB: {} as D1Database,
    AI_RATE_LIMITER: {
      limit: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as RateLimit,
  };
}

function request(
  path: string,
  body?: unknown,
  headers: HeadersInit = {},
): Request {
  return new Request(`https://api.hindipdfeditor.com${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("AI API router", () => {
  it("returns public capabilities without exposing secrets", async () => {
    const response = await handleRequest(
      request("/v1/capabilities"),
      environment(),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      translation: { enabled: true, directions: ["hi-en", "en-hi"] },
      aiOcr: { enabled: true, requiresConsent: true },
    });
    expect(JSON.stringify(body)).not.toContain("gemini-secret");
  });

  it("enforces allowed web origins", async () => {
    const response = await handleRequest(
      request("/v1/capabilities", undefined, {
        Origin: "https://attacker.example",
      }),
      environment(),
    );
    expect(response.status).toBe(403);
  });

  it("creates Android sessions without Turnstile", async () => {
    const response = await handleRequest(
      request("/v1/session", {
        version: AI_API_VERSION,
        clientId: "android-installation-123456",
        platform: "android",
      }),
      environment(),
      undefined,
      { now: () => NOW },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      version: AI_API_VERSION,
      token: expect.any(String),
    });
  });

  it("validates Turnstile server-side for web sessions", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: "hindipdfeditor.com",
          action: "ai-session",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const response = await handleRequest(
      request(
        "/v1/session",
        {
          version: AI_API_VERSION,
          clientId: "browser-installation-123456",
          platform: "web",
          turnstileToken: "token",
        },
        { Origin: "https://hindipdfeditor.com" },
      ),
      environment(),
      undefined,
      { fetchImpl: fetchMock, now: () => NOW },
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("rejects unauthenticated translation before calling Gemini", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const response = await handleRequest(
      request("/v1/translate", {
        version: AI_API_VERSION,
        requestId: "request-1",
        jobId: "job-1",
        direction: "hi-en",
        lines: [{ id: "line-1", page: 0, text: "भारत सरकार" }],
      }),
      environment(),
      undefined,
      {
        fetchImpl: fetchMock,
        quotaStore: new MemoryQuotaStore(),
        now: () => NOW,
      },
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("translates an authenticated request through the stateless Gemini boundary", async () => {
    const session = await createSession(
      "android-installation-123456",
      "android",
      SECRET,
      NOW,
    );
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          steps: [
            {
              type: "model_output",
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    results: [
                      { id: "line-1", translated_text: "Government of India" },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const response = await handleRequest(
      request(
        "/v1/translate",
        {
          version: AI_API_VERSION,
          requestId: "request-2",
          jobId: "job-2",
          direction: "hi-en",
          lines: [{ id: "line-1", page: 0, text: "भारत सरकार" }],
        },
        { Authorization: `Bearer ${session.token}` },
      ),
      environment(),
      undefined,
      {
        fetchImpl: fetchMock,
        quotaStore: new MemoryQuotaStore(),
        now: () => NOW,
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      requestId: "request-2",
      results: [
        {
          id: "line-1",
          translatedText: "Government of India",
          status: "translated",
        },
      ],
    });
  });
});
