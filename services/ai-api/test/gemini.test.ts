import {
  AI_API_VERSION,
  type OcrRequest,
  type TranslationRequest,
} from "@hindipdfeditor/translation-contract";
import { describe, expect, it, vi } from "vitest";

import type { Env } from "../src/env";
import { ocrWithGemini, translateWithGemini } from "../src/gemini";

const env = {
  GEMINI_API_KEY: "secret-key",
  GEMINI_MODEL: "gemini-3.5-flash",
} as Env;

function interaction(output: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      steps: [
        {
          type: "model_output",
          content: [{ type: "text", text: JSON.stringify(output) }],
        },
      ],
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

describe("Gemini translation boundary", () => {
  it("uses stateless structured output and returns validated Hindi to English lines", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      interaction({
        results: [{ id: "line-1", translated_text: "Government of India" }],
      }),
    );
    const request: TranslationRequest = {
      version: AI_API_VERSION,
      requestId: "request-1",
      jobId: "job-1",
      direction: "hi-en",
      lines: [{ id: "line-1", page: 0, text: "भारत सरकार" }],
    };
    const response = await translateWithGemini(request, env, fetchMock);
    expect(response.results).toEqual([
      {
        id: "line-1",
        translatedText: "Government of India",
        status: "translated",
      },
    ]);
    const sent = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(sent.store).toBe(false);
    expect(sent.model).toBe("gemini-3.5-flash");
    expect(sent.response_format).toMatchObject({
      mime_type: "application/json",
    });
  });

  it("restores protected fragments for English to Hindi", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      interaction({
        results: [
          {
            id: "line-1",
            translated_text: "कर्मचारी का नाम: ⟦P0⟧, संदर्भ ⟦P1⟧",
          },
        ],
      }),
    );
    const response = await translateWithGemini(
      {
        version: AI_API_VERSION,
        requestId: "request-2",
        jobId: "job-2",
        direction: "en-hi",
        lines: [
          {
            id: "line-1",
            page: 0,
            text: "Employee Name: Seema Sharma, reference REF-2026/07",
          },
        ],
      },
      env,
      fetchMock,
    );
    expect(response.results[0]?.translatedText).toContain("Seema Sharma");
    expect(response.results[0]?.translatedText).toContain("REF-2026/07");
  });

  it("fails a line rather than returning text in the wrong target script", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      interaction({
        results: [{ id: "line-1", translated_text: "भारत सरकार" }],
      }),
    );
    const response = await translateWithGemini(
      {
        version: AI_API_VERSION,
        requestId: "request-3",
        jobId: "job-3",
        direction: "hi-en",
        lines: [{ id: "line-1", page: 0, text: "भारत सरकार" }],
      },
      env,
      fetchMock,
    );
    expect(response.results[0]).toMatchObject({
      status: "failed",
      translatedText: null,
    });
  });

  it("retries one transient response and rejects mismatched IDs", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "busy" } }), {
          status: 503,
        }),
      )
      .mockResolvedValueOnce(
        interaction({ results: [{ id: "wrong", translated_text: "Text" }] }),
      );
    await expect(
      translateWithGemini(
        {
          version: AI_API_VERSION,
          requestId: "request-4",
          jobId: "job-4",
          direction: "hi-en",
          lines: [{ id: "line-1", page: 0, text: "भारत" }],
        },
        env,
        fetchMock,
      ),
    ).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("Gemini OCR boundary", () => {
  it("returns only valid normalized boxes", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      interaction({
        lines: [{ text: "भारत सरकार", box_2d: [10, 20, 110, 920] }],
      }),
    );
    const request: OcrRequest = {
      version: AI_API_VERSION,
      requestId: "ocr-1",
      jobId: "ocr-job",
      page: 0,
      consent: true,
      imageBase64: "YWJj",
      mimeType: "image/jpeg",
      imagePxWidth: 1200,
      imagePxHeight: 1600,
    };
    await expect(ocrWithGemini(request, env, fetchMock)).resolves.toMatchObject(
      {
        lines: [{ text: "भारत सरकार", box_2d: [10, 20, 110, 920] }],
      },
    );
  });

  it("fails closed on malformed boxes", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        interaction({ lines: [{ text: "bad", box_2d: [10, 20, 10, 30] }] }),
      );
    const request: OcrRequest = {
      version: AI_API_VERSION,
      requestId: "ocr-2",
      jobId: "ocr-job",
      page: 0,
      consent: true,
      imageBase64: "YWJj",
      mimeType: "image/jpeg",
      imagePxWidth: 1200,
      imagePxHeight: 1600,
    };
    await expect(ocrWithGemini(request, env, fetchMock)).rejects.toMatchObject({
      code: "INVALID_OUTPUT",
    });
  });
});
