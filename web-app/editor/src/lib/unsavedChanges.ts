import { useEffect } from "react";
import type { DocumentState } from "../state/editStore";

/** Snapshot only authoring changes, excluding OCR cache and viewport state. */
export function editSnapshot(document: DocumentState): string {
  return JSON.stringify(document.pages.map((page) => page.edits));
}

/** Exporting an older snapshot must not clear newer edits made during export. */
export function hasUnexportedChanges(
  document: DocumentState | null,
  exportedSnapshot: string | null,
): boolean {
  if (!document) return false;
  if (exportedSnapshot !== null)
    return editSnapshot(document) !== exportedSnapshot;
  return document.pages.some((page) => page.edits.length > 0);
}

/** Browser-native protection covers refresh, tab close and full-page navigation. */
export function useUnsavedChanges(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
}
