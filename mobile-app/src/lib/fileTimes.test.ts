import { fileTimeMs, normalizeEpochMs, secondsToMs } from './fileTimes';

const MS = Date.UTC(2026, 9, 24, 9, 30);
const SEC = MS / 1000;

describe('secondsToMs', () => {
  it('converts epoch seconds from the native scan to epoch ms', () => {
    expect(secondsToMs(SEC)).toBe(MS);
  });
  it('keeps a missing value missing', () => {
    expect(secondsToMs(undefined)).toBeUndefined();
    expect(secondsToMs(0)).toBeUndefined();
  });
});

describe('normalizeEpochMs', () => {
  it('scales values persisted in seconds', () => {
    expect(normalizeEpochMs(SEC)).toBe(MS);
  });
  it('leaves values already in ms alone', () => {
    expect(normalizeEpochMs(MS)).toBe(MS);
  });
  it('treats zero and missing as unknown', () => {
    expect(normalizeEpochMs(0)).toBeUndefined();
    expect(normalizeEpochMs(undefined)).toBeUndefined();
  });
});

describe('fileTimeMs', () => {
  it('prefers dateModified, then openedAt, then the date string', () => {
    expect(fileTimeMs({ dateModified: MS, openedAt: 1, date: 'x' })).toBe(MS);
    expect(fileTimeMs({ openedAt: MS, date: 'Oct 1, 2020' })).toBe(MS);
    expect(fileTimeMs({ date: '2026-10-24T09:30:00Z' })).toBe(MS);
  });
  it('returns NaN when nothing is usable', () => {
    expect(fileTimeMs({ date: 'Today' })).toBeNaN();
  });
});
