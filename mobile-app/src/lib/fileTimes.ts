/** Epoch values below this (ms) are taken to be seconds: 1e12 ms is September 2001. */
const SECONDS_THRESHOLD = 1e12;

/** Converts epoch seconds (the native PDF scan's `dateModified`) to epoch ms; 0 or missing is undefined. */
export function secondsToMs(epochSeconds: number | undefined): number | undefined {
  return epochSeconds === undefined || epochSeconds <= 0 ? undefined : epochSeconds * 1000;
}

/**
 * Returns an epoch-ms value for a stored timestamp that may be in seconds (entries persisted
 * before the scan was converted to ms) or ms. Zero, negative and missing values return undefined.
 */
export function normalizeEpochMs(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return undefined;
  return value < SECONDS_THRESHOLD ? value * 1000 : value;
}

/**
 * Best time for a file in epoch ms: `dateModified` (ms), then `openedAt` (ms), then the parsed
 * display `date`. NaN when none is usable.
 */
export function fileTimeMs(file: {
  dateModified?: number;
  openedAt?: number;
  date: string;
}): number {
  return file.dateModified ?? file.openedAt ?? Date.parse(file.date);
}
