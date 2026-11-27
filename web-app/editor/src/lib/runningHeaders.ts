/**
 * Detects running headers and footers across a multi-page PDF so PDF to Word writes them once as
 * a Word header/footer (or drops them from the body) instead of repeating them inside the flow on
 * every page.
 *
 * A line qualifies when its digit-normalised text appears at about the same place in the top or
 * bottom 12 % of at least 3 pages and at least half of the converted pages. Unique lines are never
 * dropped.
 */

import type { DetectedTable } from './tableDetect';
import type { OcrLine } from '../state/editStore';

export type RunningRun = { kind: 'text'; text: string } | { kind: 'pageNumber' };

export type RunningLine = {
  runs: RunningRun[];
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
};

export type PageLinesInput = {
  widthPt: number;
  heightPt: number;
  lines: readonly OcrLine[];
  tables?: readonly DetectedTable[];
};

export type RunningHeadersResult = {
  /** Per-page set of lines to exclude from the document body. */
  omittedPerPage: Set<OcrLine>[];
  /** Lines to emit once in the Word document header. */
  header: RunningLine[];
  /** Lines to emit once in the Word document footer. */
  footer: RunningLine[];
};

/** Top and bottom page margins (as a share of page height) where running headers/footers live. */
const EDGE_BAND_RATIO = 0.12;
/** Vertical position tolerance (share of page height) for matching the same running line across pages. */
const Y_TOLERANCE_RATIO = 0.025;
/** Horizontal position tolerance (share of page width) for matching left, right, or centred alignment. */
const X_TOLERANCE_RATIO = 0.08;
/** Vertical proximity (share of page height) for combining two running fragments on the same row. */
const SAME_BAND_ROW_RATIO = 0.012;
/** Fewest pages a repeated line must appear on to count as a running header or footer. */
const MIN_PAGES = 3;
/** Font size as a share of box height (matches `wordLayout.ts`). */
const SIZE_PER_HEIGHT = 0.8;

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/gu;
const DIGITS = /[0-9\u0966-\u096F]+/gu;
const DIGIT_SPLIT = /([0-9\u0966-\u096F]+)/u;

/** Normalises a line's text for cross-page repetition matching: digits become `#`. */
export function normalizeRunningText(text: string): string {
  return text
    .normalize('NFC')
    .replace(ZERO_WIDTH, '')
    .replace(DIGITS, '#')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

function parseDigits(token: string): number {
  let value = 0;
  for (const ch of token) {
    const code = ch.charCodeAt(0);
    const digit = code >= 0x0966 && code <= 0x096f ? code - 0x0966 : code - 0x30;
    value = value * 10 + digit;
  }
  return value;
}

type Band = 'header' | 'footer';

type Candidate = {
  pageIndex: number;
  line: OcrLine;
  band: Band;
  key: string;
  yRatio: number;
  xRatio: number;
  rightRatio: number;
  midXRatio: number;
};

type Cluster = {
  band: Band;
  key: string;
  yRatio: number;
  xRatio: number;
  rightRatio: number;
  midXRatio: number;
  entries: Candidate[];
};

function insideAnyTable(line: OcrLine, tables: readonly DetectedTable[] | undefined): boolean {
  if (!tables || tables.length === 0) return false;
  const cx = line.xPt + line.wPt / 2;
  const cy = line.yPt + line.hPt / 2;
  return tables.some((t) => cx >= t.xPt && cx <= t.xPt + t.wPt && cy >= t.yPt && cy <= t.yPt + t.hPt);
}

function samePlace(a: Candidate, cluster: Cluster): boolean {
  if (Math.abs(a.yRatio - cluster.yRatio) > Y_TOLERANCE_RATIO) return false;
  return (
    Math.abs(a.xRatio - cluster.xRatio) <= X_TOLERANCE_RATIO ||
    Math.abs(a.rightRatio - cluster.rightRatio) <= X_TOLERANCE_RATIO ||
    Math.abs(a.midXRatio - cluster.midXRatio) <= X_TOLERANCE_RATIO
  );
}

/**
 * Turns a qualified cluster into a `RunningLine` for Word's header/footer, replacing an
 * incrementing page-number slot with `{ kind: 'pageNumber' }`. Returns null when digits vary
 * irregularly (the lines are still dropped from the body, but no misleading static number is
 * emitted in the shared Word header/footer).
 */
function buildRunningLine(cluster: Cluster): RunningLine | null {
  const ordered = [...cluster.entries].sort((a, b) => a.pageIndex - b.pageIndex);
  const splitParts = ordered.map((e) =>
    e.line.text
      .normalize('NFC')
      .replace(ZERO_WIDTH, '')
      .replace(/\s+/gu, ' ')
      .trim()
      .split(DIGIT_SPLIT),
  );
  const partCount = splitParts[0].length;
  if (splitParts.some((parts) => parts.length !== partCount)) return null;

  const rawRuns: RunningRun[] = [];
  for (let idx = 0; idx < partCount; idx += 1) {
    if (idx % 2 === 0) {
      const piece = splitParts[0][idx];
      if (piece.length > 0) rawRuns.push({ kind: 'text', text: piece });
    } else {
      const values = splitParts.map((parts) => parseDigits(parts[idx]));
      const allEqual = values.every((v) => v === values[0]);
      if (allEqual) {
        rawRuns.push({ kind: 'text', text: splitParts[0][idx] });
      } else {
        const tracksPage = ordered.every((e, i) => values[i] - values[0] === e.pageIndex - ordered[0].pageIndex);
        if (!tracksPage) return null;
        rawRuns.push({ kind: 'pageNumber' });
      }
    }
  }

  // Merge adjacent text runs so Word XML stays compact.
  const runs: RunningRun[] = [];
  for (const run of rawRuns) {
    const last = runs[runs.length - 1];
    if (run.kind === 'text' && last && last.kind === 'text') {
      last.text += run.text;
    } else {
      runs.push({ ...run });
    }
  }
  if (runs.length === 0) return null;

  const sample = ordered[0].line;
  const align: 'left' | 'center' | 'right' =
    Math.abs(cluster.midXRatio - 0.5) <= 0.06
      ? 'center'
      : cluster.xRatio > 0.55
        ? 'right'
        : 'left';

  return {
    runs,
    fontSizePt: Math.max(6, Math.round(sample.hPt * SIZE_PER_HEIGHT * 2) / 2),
    bold: Boolean(sample.font?.bold),
    italic: Boolean(sample.font?.italic),
    align,
  };
}

function finalizeBandLines(clusters: Cluster[]): RunningLine[] {
  const sorted = [...clusters].sort((a, b) => a.yRatio - b.yRatio || a.xRatio - b.xRatio);
  const rows: { yRatio: number; lines: RunningLine[] }[] = [];
  for (const cluster of sorted) {
    const built = buildRunningLine(cluster);
    if (!built) continue;
    const row = rows.find((r) => Math.abs(r.yRatio - cluster.yRatio) <= SAME_BAND_ROW_RATIO);
    if (row) row.lines.push(built);
    else rows.push({ yRatio: cluster.yRatio, lines: [built] });
  }
  return rows.map((row) => {
    if (row.lines.length === 1) return row.lines[0];
    const combined: RunningRun[] = [];
    row.lines.forEach((line, index) => {
      if (index > 0) combined.push({ kind: 'text', text: '   ' });
      for (const run of line.runs) {
        const last = combined[combined.length - 1];
        if (run.kind === 'text' && last && last.kind === 'text') last.text += run.text;
        else combined.push({ ...run });
      }
    });
    return { ...row.lines[0], runs: combined, align: 'left' };
  });
}

/**
 * Finds running headers and footers across `pages`.
 * Only runs when at least 3 pages are converted; lines must repeat on at least 3 pages and at
 * least half of the converted pages in the top or bottom 12 % band.
 */
export function detectRunningHeadersFooters(pages: readonly PageLinesInput[]): RunningHeadersResult {
  const totalPages = pages.length;
  const omittedPerPage = pages.map(() => new Set<OcrLine>());
  if (totalPages < MIN_PAGES) {
    return { omittedPerPage, header: [], footer: [] };
  }
  const minPages = Math.max(MIN_PAGES, Math.ceil(totalPages / 2));

  const clusters: Cluster[] = [];
  pages.forEach((page, pageIndex) => {
    if (page.widthPt <= 0 || page.heightPt <= 0) return;
    for (const line of page.lines) {
      if (!line.text.trim()) continue;
      if (insideAnyTable(line, page.tables)) continue;
      const centerY = line.yPt + line.hPt / 2;
      const yRatio = centerY / page.heightPt;
      const band: Band | null =
        yRatio <= EDGE_BAND_RATIO ? 'header' : yRatio >= 1 - EDGE_BAND_RATIO ? 'footer' : null;
      if (!band) continue;
      const key = normalizeRunningText(line.text);
      if (!key) continue;

      const cand: Candidate = {
        pageIndex,
        line,
        band,
        key,
        yRatio,
        xRatio: line.xPt / page.widthPt,
        rightRatio: (line.xPt + line.wPt) / page.widthPt,
        midXRatio: (line.xPt + line.wPt / 2) / page.widthPt,
      };
      const existing = clusters.find(
        (c) =>
          c.band === band &&
          c.key === key &&
          samePlace(cand, c) &&
          !c.entries.some((e) => e.pageIndex === pageIndex),
      );
      if (existing) {
        existing.entries.push(cand);
      } else {
        clusters.push({
          band,
          key,
          yRatio: cand.yRatio,
          xRatio: cand.xRatio,
          rightRatio: cand.rightRatio,
          midXRatio: cand.midXRatio,
          entries: [cand],
        });
      }
    }
  });

  const qualified = clusters.filter((c) => c.entries.length >= minPages);
  for (const cluster of qualified) {
    for (const entry of cluster.entries) {
      omittedPerPage[entry.pageIndex].add(entry.line);
    }
  }

  return {
    omittedPerPage,
    header: finalizeBandLines(qualified.filter((c) => c.band === 'header')),
    footer: finalizeBandLines(qualified.filter((c) => c.band === 'footer')),
  };
}
