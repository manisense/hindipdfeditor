import type { Draft } from './draft';

const DB_NAME = 'hpe-drafts';
const STORE = 'drafts';
const DRAFT_KEY = 'draft';
const PDF_KEY = 'pdf';

type StoredPdf = { documentId: string; bytes: Blob };

/** Document whose PDF bytes are already stored, so each save rewrites only the small draft. */
let storedPdfDocumentId: string | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request ? request.result : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Keeps the unsaved work in this browser (IndexedDB), replacing any earlier draft. The PDF bytes
 * are written once per opened file.
 *
 * @returns Whether the draft was written; false when storage is unavailable or full.
 */
export async function saveDraft(draft: Draft, pdfBytes: Uint8Array): Promise<boolean> {
  try {
    await run('readwrite', (store) => {
      if (storedPdfDocumentId !== draft.documentId) {
        const pdf: StoredPdf = { documentId: draft.documentId, bytes: new Blob([pdfBytes.slice().buffer]) };
        store.put(pdf, PDF_KEY);
      }
      store.put(draft, DRAFT_KEY);
    });
    storedPdfDocumentId = draft.documentId;
    return true;
  } catch (error) {
    console.warn('Could not keep the draft in this browser', error);
    return false;
  }
}

/** The kept draft, without its PDF, or null when there is none (or storage is unavailable). */
export async function loadDraft(): Promise<Draft | null> {
  try {
    const draft = await run<Draft>('readonly', (store) => store.get(DRAFT_KEY));
    return draft && draft.version === 1 ? draft : null;
  } catch (error) {
    console.warn('Could not read the kept draft', error);
    return null;
  }
}

/** The PDF a draft was made on, or null when it is missing. */
export async function loadDraftPdf(draft: Draft): Promise<Uint8Array | null> {
  try {
    const pdf = await run<StoredPdf>('readonly', (store) => store.get(PDF_KEY));
    if (!pdf || pdf.documentId !== draft.documentId) return null;
    storedPdfDocumentId = pdf.documentId;
    return new Uint8Array(await pdf.bytes.arrayBuffer());
  } catch (error) {
    console.warn('Could not read the kept PDF', error);
    return null;
  }
}

/** Deletes the kept draft and its PDF from this browser. */
export async function clearDraft(): Promise<void> {
  storedPdfDocumentId = null;
  try {
    await run('readwrite', (store) => {
      store.delete(DRAFT_KEY);
      store.delete(PDF_KEY);
    });
  } catch (error) {
    console.warn('Could not delete the kept draft', error);
  }
}
