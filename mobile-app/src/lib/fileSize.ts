/**
 * Short file size for display. `bytes` is in bytes; returns "0 KB" for empty or unknown sizes,
 * whole KB under 1 MB (at least 1 KB), and MB with one decimal above that.
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * How much smaller `newBytes` is than `originalBytes`, as a whole percent of the original. Both
 * are in bytes. Returns 0 for an unknown (0) original, and 0 or a negative number when the new
 * file is not smaller.
 */
export function percentSmaller(originalBytes: number, newBytes: number): number {
  if (!originalBytes || originalBytes <= 0) return 0;
  return Math.round(((originalBytes - newBytes) / originalBytes) * 100);
}
