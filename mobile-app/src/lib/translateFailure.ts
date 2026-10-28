import { AiServiceError } from './aiApiClient';

/** Thrown when text detection fails on a page, so the tool never exports it untranslated. */
export class TextDetectionError extends Error {
  /** @param pageIndex Zero-based PDF page index whose text detection failed. */
  constructor(
    readonly pageIndex: number,
    cause: unknown,
  ) {
    super(`Text detection failed on page ${pageIndex + 1}.`, { cause });
    this.name = 'TextDetectionError';
  }
}

/** Thrown when no page held text in the source language, so there is nothing to translate. */
export class NoTextFoundError extends Error {
  constructor() {
    super('No text in the source language was found.');
    this.name = 'NoTextFoundError';
  }
}

/** Why a Translate run stopped, each mapped to its own message in the tool. */
export type TranslateFailure =
  'quota' | 'busy' | 'offline' | 'unavailable' | 'detection-failed' | 'no-text';

/** Maps an error thrown during a Translate run to the reason shown to the person. */
export function classifyTranslateFailure(error: unknown): TranslateFailure {
  if (error instanceof TextDetectionError) return 'detection-failed';
  if (error instanceof NoTextFoundError) return 'no-text';
  if (!(error instanceof AiServiceError)) return 'unavailable';
  switch (error.code) {
    case 'QUOTA_EXHAUSTED':
      return 'quota';
    case 'RATE_LIMITED':
      return 'busy';
    case 'NETWORK':
    case 'TIMEOUT':
      return 'offline';
    default:
      return 'unavailable';
  }
}
