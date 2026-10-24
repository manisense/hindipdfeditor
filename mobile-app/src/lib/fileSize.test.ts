import { formatFileSize } from './fileSize';

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
