import {
  AI_API_VERSION,
  type OcrLineResult,
  type OcrRequest,
  type OcrResponse,
  type TranslationRequest,
  type TranslationResponse,
  type TranslationResult,
} from "@hindipdfeditor/translation-contract";

import type { Env } from "./env";
import { ApiError } from "./errors";
import { protectFragments, restoreFragments } from "./protectedFragments";

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEVANAGARI_RE = /[\u0900-\u097f]/u;
const LATIN_RE = /[A-Za-z]/u;

type InteractionResponse = {
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
  error?: { message?: string };
};

type ModelTranslationResult = { id: string; translated_text: string };

function interactionText(value: unknown): string {
  const response = value as InteractionResponse;
  if (response.error?.message) throw new Error(response.error.message);
  const text = response.steps
    ?.filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === "text")
    .map((content) => content.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini returned no text output");
  return text;
}

async function geminiRequest(
  env: Env,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(GEMINI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY,
        },
        body: JSON.stringify({
          model: env.GEMINI_MODEL,
          store: false,
          ...body,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      if (attempt === 0) continue;
      throw new ApiError(
        "TEMPORARILY_UNAVAILABLE",
        "Gemini is temporarily unavailable.",
        503,
        true,
      );
    }
    const json: unknown = await response.json().catch(() => null);
    if (response.ok) return json;
    if (attempt === 0 && [429, 500, 503, 504].includes(response.status))
      continue;
    if (response.status === 429) {
      throw new ApiError(
        "RATE_LIMITED",
        "Gemini capacity is temporarily limited. Please retry.",
        429,
        true,
      );
    }
    throw new ApiError(
      "TEMPORARILY_UNAVAILABLE",
      "Gemini could not complete this request.",
      503,
      true,
    );
  }
  throw new ApiError(
    "TEMPORARILY_UNAVAILABLE",
    "Gemini is temporarily unavailable.",
    503,
    true,
  );
}

function isSourceCandidate(
  text: string,
  direction: TranslationRequest["direction"],
): boolean {
  return direction === "hi-en" ? DEVANAGARI_RE.test(text) : LATIN_RE.test(text);
}

function validatesTarget(
  text: string,
  direction: TranslationRequest["direction"],
): boolean {
  if (direction === "hi-en")
    return LATIN_RE.test(text) && !DEVANAGARI_RE.test(text);
  return DEVANAGARI_RE.test(text);
}

export async function translateWithGemini(
  request: TranslationRequest,
  env: Env,
  fetchImpl: typeof fetch,
): Promise<TranslationResponse> {
  const protectedById = new Map(
    request.lines.map(
      (line) =>
        [line.id, { line, protected: protectFragments(line.text) }] as const,
    ),
  );
  const eligible = [...protectedById.values()].filter(({ line }) =>
    isSourceCandidate(line.text, request.direction),
  );
  const outputById = new Map<string, TranslationResult>();
  for (const { line } of protectedById.values()) {
    if (!isSourceCandidate(line.text, request.direction)) {
      outputById.set(line.id, {
        id: line.id,
        translatedText: null,
        status: "skipped",
        reason: "No source-language text was detected in this line.",
      });
    }
  }

  if (eligible.length > 0) {
    const target =
      request.direction === "hi-en"
        ? "natural, faithful English"
        : "formal standard Hindi";
    const input = {
      direction: request.direction,
      rules: [
        `Translate only into ${target}.`,
        "Return every line ID exactly once and never merge or split lines.",
        "Preserve tokens such as ⟦P0⟧ byte-for-byte and in their original position.",
        "Preserve meaning, administrative terminology, punctuation, and already-target-language fragments.",
        "Do not add commentary or HTML.",
      ],
      lines: eligible.map(({ line, protected: protectedText }) => ({
        id: line.id,
        page: line.page,
        text: protectedText.text,
        block: line.block,
        context_before: line.contextBefore,
        context_after: line.contextAfter,
      })),
    };
    const json = await geminiRequest(
      env,
      {
        input: JSON.stringify(input),
        generation_config: { temperature: 0.1, thinking_level: "minimal" },
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: {
            type: "object",
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    translated_text: { type: "string" },
                  },
                  required: ["id", "translated_text"],
                },
              },
            },
            required: ["results"],
          },
        },
      },
      fetchImpl,
    );

    let modelResults: ModelTranslationResult[];
    try {
      const parsed = JSON.parse(interactionText(json)) as { results?: unknown };
      if (!Array.isArray(parsed.results))
        throw new Error("results was not an array");
      modelResults = parsed.results as ModelTranslationResult[];
    } catch {
      throw new ApiError(
        "INVALID_OUTPUT",
        "Gemini returned an invalid translation response.",
        502,
        true,
      );
    }
    const expectedIds = new Set(eligible.map(({ line }) => line.id));
    const seen = new Set<string>();
    for (const result of modelResults) {
      if (
        !result ||
        typeof result.id !== "string" ||
        typeof result.translated_text !== "string" ||
        !expectedIds.has(result.id) ||
        seen.has(result.id)
      ) {
        throw new ApiError(
          "INVALID_OUTPUT",
          "Gemini returned mismatched translation line IDs.",
          502,
          true,
        );
      }
      seen.add(result.id);
      const source = protectedById.get(result.id);
      if (!source) continue;
      try {
        const translatedText = restoreFragments(
          result.translated_text.trim(),
          source.protected.fragments,
        );
        if (
          translatedText === source.line.text.trim() ||
          !validatesTarget(translatedText, request.direction)
        ) {
          throw new Error("translation did not match the target language");
        }
        outputById.set(result.id, {
          id: result.id,
          translatedText,
          status: "translated",
        });
      } catch {
        outputById.set(result.id, {
          id: result.id,
          translatedText: null,
          status: "failed",
          reason: "The translated line failed safety validation.",
        });
      }
    }
    if (seen.size !== expectedIds.size) {
      throw new ApiError(
        "INVALID_OUTPUT",
        "Gemini omitted one or more translation lines.",
        502,
        true,
      );
    }
  }

  return {
    version: AI_API_VERSION,
    requestId: request.requestId,
    model: env.GEMINI_MODEL,
    results: request.lines.map((line) => {
      const result = outputById.get(line.id);
      if (!result)
        throw new ApiError(
          "INVALID_OUTPUT",
          "A translation result was lost.",
          502,
          true,
        );
      return result;
    }),
  };
}

export async function ocrWithGemini(
  request: OcrRequest,
  env: Env,
  fetchImpl: typeof fetch,
): Promise<OcrResponse> {
  const json = await geminiRequest(
    env,
    {
      input: [
        {
          type: "text",
          text: "Read every printed Hindi and English line. Return exact transcription and box_2d as [ymin,xmin,ymax,xmax] normalized 0-1000. Return no commentary.",
        },
        {
          type: "image",
          mime_type: request.mimeType,
          data: request.imageBase64,
        },
      ],
      generation_config: { temperature: 0, thinking_level: "minimal" },
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: {
          type: "object",
          properties: {
            lines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  box_2d: { type: "array", items: { type: "number" } },
                },
                required: ["text", "box_2d"],
              },
            },
          },
          required: ["lines"],
        },
      },
    },
    fetchImpl,
  );
  let lines: OcrLineResult[];
  try {
    const parsed = JSON.parse(interactionText(json)) as { lines?: unknown };
    if (!Array.isArray(parsed.lines)) throw new Error("lines was not an array");
    lines = parsed.lines.map((entry) => {
      const line = entry as { text?: unknown; box_2d?: unknown };
      if (
        typeof line.text !== "string" ||
        line.text.trim() === "" ||
        !Array.isArray(line.box_2d) ||
        line.box_2d.length !== 4 ||
        !line.box_2d.every(
          (coordinate) =>
            typeof coordinate === "number" &&
            coordinate >= 0 &&
            coordinate <= 1000,
        )
      ) {
        throw new Error("invalid OCR line");
      }
      const [yMin, xMin, yMax, xMax] = line.box_2d as [
        number,
        number,
        number,
        number,
      ];
      if (yMax <= yMin || xMax <= xMin) throw new Error("invalid OCR box");
      return { text: line.text.trim(), box_2d: [yMin, xMin, yMax, xMax] };
    });
  } catch {
    throw new ApiError(
      "INVALID_OUTPUT",
      "Gemini returned invalid OCR geometry.",
      502,
      true,
    );
  }
  return {
    version: AI_API_VERSION,
    requestId: request.requestId,
    model: env.GEMINI_MODEL,
    lines,
  };
}
