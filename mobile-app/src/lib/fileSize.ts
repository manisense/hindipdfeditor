/**
 * Short file size for display. `bytes` is in bytes; returns "0 KB" for empty or unknown sizes,
 * whole KB under 1 MB (at least 1 KB), and MB with one decimal above that.
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
