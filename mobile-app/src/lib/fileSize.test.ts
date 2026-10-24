import { formatFileSize, percentSmaller } from './fileSize';

describe('formatFileSize', () => {
  it('shows 0 KB for empty or unknown sizes', () => {
    expect(formatFileSize(0)).toBe('0 KB');
    expect(formatFileSize(Number.NaN)).toBe('0 KB');
  });
  it('rounds small files up to at least 1 KB', () => {
    expect(formatFileSize(200)).toBe('1 KB');
    expect(formatFileSize(5 * 1024)).toBe('5 KB');
  });
  it('shows MB with one decimal from 1 MB', () => {
    expect(formatFileSize(6.2 * 1024 * 1024)).toBe('6.2 MB');
  });
});

describe('percentSmaller', () => {
  it('returns how much smaller the new file is, rounded', () => {
    expect(percentSmaller(4_800_000, 1_200_000)).toBe(75);
  });
  it('is 0 or negative when the new file is not smaller', () => {
    expect(percentSmaller(1000, 1000)).toBe(0);
    expect(percentSmaller(1000, 1500)).toBe(-50);
  });
  it('is 0 when the original size is unknown', () => {
    expect(percentSmaller(0, 500)).toBe(0);
  });
});
