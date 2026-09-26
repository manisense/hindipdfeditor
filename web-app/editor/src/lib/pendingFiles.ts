/**
 * In-memory hand-off of files picked on the home page to the tool that opens next.
 * Files never leave the page's memory: no upload, no browser storage. The hand-off only
 * survives a client-side route change (see `navigation.ts`), not a full page load.
 */
let pending: File[] | null = null;

/** Holds files for the next tool DropZone that mounts. */
export function stashPendingFiles(files: File[]): void {
  pending = files.length > 0 ? files : null;
}

/** Returns the held files once and clears them. */
export function takePendingFiles(): File[] | null {
  const files = pending;
  pending = null;
  return files;
}
