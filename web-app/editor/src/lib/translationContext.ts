import type { TranslationLine } from "@hindipdfeditor/translation-contract";

import type { OcrLine } from "../state/editStore";

type ContextSourceLine = Pick<OcrLine, "id" | "text">;

const MAX_CONTEXT_CODE_POINTS = 400;

function normalizedContext(text: string): string | undefined {
  const normalized = text.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (normalized.length === 0) return undefined;
  return [...normalized].slice(0, MAX_CONTEXT_CODE_POINTS).join("");
}

function adjacentContext(
  orderedPageLines: readonly ContextSourceLine[],
  index: number,
  step: -1 | 1,
): string | undefined {
  for (
    let candidateIndex = index + step;
    candidateIndex >= 0 && candidateIndex < orderedPageLines.length;
    candidateIndex += step
  ) {
    const candidate = orderedPageLines[candidateIndex];
    if (!candidate) continue;
    const context = normalizedContext(candidate.text);
    if (context) return context;
  }
  return undefined;
}

/**
 * Builds line-preserving translation input with neighboring page text for
 * disambiguation. `page` is a zero-based PDF page index; `orderedPageLines`
 * must be in the detector's reading order.
 */
export function buildTranslationLinesWithContext(
  page: number,
  orderedPageLines: readonly ContextSourceLine[],
  sourceLines: readonly ContextSourceLine[],
): TranslationLine[] {
  const indexById = new Map(
    orderedPageLines.map((line, index) => [line.id, index] as const),
  );

  return sourceLines.map((line) => {
    const index = indexById.get(line.id);
    if (index === undefined) return { id: line.id, page, text: line.text };

    const contextBefore = adjacentContext(orderedPageLines, index, -1);
    const contextAfter = adjacentContext(orderedPageLines, index, 1);
    return {
      id: line.id,
      page,
      text: line.text,
      ...(contextBefore ? { contextBefore } : {}),
      ...(contextAfter ? { contextAfter } : {}),
    };
  });
}
