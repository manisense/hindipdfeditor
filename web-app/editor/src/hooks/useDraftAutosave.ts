import { useEffect, useRef, useState } from 'react';

import { draftOf, type Draft, type DraftPairing } from '../lib/draft';
import { clearDraft, loadDraft, loadDraftPdf, saveDraft } from '../lib/draftStorage';
import { getPdfBytes } from '../lib/pdfToImages';
import type { DocumentState } from '../state/editStore';

/** Wait after the last change before keeping the draft, in ms. */
const DRAFT_SAVE_DELAY_MS = 800;

type Options = {
  document: DocumentState | null;
  /** Whether there are changes not yet exported. */
  dirty: boolean;
  /** Whether a page's text detection has finished (its lines are kept with the draft). */
  detected: (pageIndex: number) => boolean;
  /** Changes when `detected` does, so the draft is kept again. */
  detectionKey: unknown;
  pairings: { readonly current: Map<string, DraftPairing> };
};

/**
 * Keeps unexported edits in this browser (see draftStorage.ts) and offers the draft kept from an
 * earlier visit while no file is open. Only the draft this visit wrote or restored is ever
 * deleted, so opening another file without editing it leaves the earlier draft in place.
 */
export function useDraftAutosave({ document, dirty, detected, detectionKey, pairings }: Options) {
  /** Draft kept from an earlier visit, offered for restoring on the open screen. */
  const [keptDraft, setKeptDraft] = useState<Draft | null>(null);
  /** Whether the latest edits are kept in this browser. */
  const [draftKept, setDraftKept] = useState(false);
  const ownDocumentIdRef = useRef<string | null>(null);
  const detectedRef = useRef(detected);
  detectedRef.current = detected;

  useEffect(() => {
    if (document) return;
    let cancelled = false;
    void loadDraft().then((draft) => {
      if (!cancelled) setKeptDraft(draft);
    });
    return () => {
      cancelled = true;
    };
  }, [document]);

  // Shortly after each change; the draft is dropped once the edits are exported.
  useEffect(() => {
    if (!document) return;
    if (!dirty) {
      if (ownDocumentIdRef.current === document.id) {
        ownDocumentIdRef.current = null;
        setDraftKept(false);
        void clearDraft();
      }
      return;
    }
    setDraftKept(false);
    const timer = window.setTimeout(() => {
      const bytes = getPdfBytes();
      if (!bytes) return;
      const draft = draftOf(document, (pageIndex) => detectedRef.current(pageIndex), pairings.current, Date.now());
      ownDocumentIdRef.current = document.id;
      void saveDraft(draft, bytes).then(setDraftKept);
    }, DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [document, dirty, detectionKey, pairings]);

  return {
    keptDraft,
    draftKept,
    /** A file was opened; `restored` when it is the kept draft. */
    opened(documentId: string, restored: boolean) {
      ownDocumentIdRef.current = restored ? documentId : null;
      setKeptDraft(null);
      setDraftKept(restored);
    },
    /** The open file was closed and its changes discarded: its draft goes too. */
    closedDiscarding(documentId: string | undefined) {
      if (documentId && ownDocumentIdRef.current === documentId) {
        ownDocumentIdRef.current = null;
        void clearDraft();
      }
      setDraftKept(false);
    },
    discardKeptDraft() {
      setKeptDraft(null);
      void clearDraft();
    },
    /** The PDF of the kept draft; when it cannot be read the draft is dropped and null returned. */
    async keptDraftPdf(draft: Draft): Promise<Uint8Array | null> {
      const bytes = await loadDraftPdf(draft);
      if (bytes) return bytes;
      setKeptDraft(null);
      await clearDraft();
      return null;
    },
  };
}
