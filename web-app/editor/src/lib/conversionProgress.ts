import type { WordPage } from './pdfToWord';

/**
 * Pages of an unfinished PDF to Word conversion, kept in this browser (IndexedDB) so a conversion
 * the phone stopped (the tab was closed or reloaded to free memory) continues where it was. One
 * job is kept at a time; storage that is unavailable or full only means no resume.
 */

const DB_NAME = 'hpe-conversions';
const STORE = 'pages';
const JOB_KEY = 'job';

/** One finished page: what goes into the Word file, and whether it needed OCR it did not get. */
export type SavedPage = { page: WordPage; unread: boolean };

type Job = { key: string; total: number };

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
 * Identifies a conversion: the same file (name, size, date) converted with the same settings.
 *
 * @param settings Everything that changes the result (OCR choice, pages), as text.
 */
export function conversionKey(file: { name: string; size: number; lastModified: number }, settings: string): string {
  return JSON.stringify([file.name, file.size, file.lastModified, settings]);
}

/** Pages already converted for `key` (by position in the job), or an empty map. */
export async function savedPages(key: string): Promise<Map<number, SavedPage>> {
  try {
    const job = await run<Job | undefined>('readonly', (store) => store.get(JOB_KEY) as IDBRequest<Job | undefined>);
    if (job?.key !== key) return new Map();
    let keys: IDBValidKey[] = [];
    let values: unknown[] = [];
    await run('readonly', (store) => {
      const keyRequest = store.getAllKeys();
      const valueRequest = store.getAll();
      keyRequest.onsuccess = () => (keys = keyRequest.result);
      valueRequest.onsuccess = () => (values = valueRequest.result);
    });
    const pages = new Map<number, SavedPage>();
    keys.forEach((slot, i) => {
      if (typeof slot === 'number') pages.set(slot, values[i] as SavedPage);
    });
    return pages;
  } catch {
    return new Map();
  }
}

/**
 * Starts keeping pages for `key`. A different job kept earlier is dropped.
 *
 * @param total Pages in the job.
 */
export async function startJob(key: string, total: number): Promise<void> {
  try {
    const job = await run<Job | undefined>('readonly', (store) => store.get(JOB_KEY) as IDBRequest<Job | undefined>);
    if (job?.key === key) return;
    await run('readwrite', (store) => {
      store.clear();
      store.put({ key, total } satisfies Job, JOB_KEY);
    });
  } catch {
    // No storage: the conversion runs without resume.
  }
}

/**
 * Keeps one finished page.
 *
 * @param slot The page's position in the job (zero-based).
 */
export async function savePage(slot: number, saved: SavedPage): Promise<void> {
  try {
    await run('readwrite', (store) => {
      store.put(saved, slot);
    });
  } catch {
    // Full or unavailable storage: this page is converted again if the job is resumed.
  }
}

/** Drops the kept job (after the Word file is made, or when the user starts over). */
export async function clearJob(): Promise<void> {
  try {
    await run('readwrite', (store) => {
      store.clear();
    });
  } catch {
    // Nothing kept.
  }
}
