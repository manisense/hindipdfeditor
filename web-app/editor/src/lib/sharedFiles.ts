import type { ToolId } from "./tools";

/**
 * Files shared to the installed app (Android share sheet). The service worker (`web-app/sw.js`)
 * stores them in IndexedDB under these names; the /share/ page offers tools for them, and the
 * chosen tool's file picker takes them. They are deleted once taken, or after an hour.
 */
const DB_NAME = "hpe-shared-files";
const STORE = "shares";
const KEY = "latest";
/** Shares older than this are ignored and deleted, in ms. */
const MAX_AGE_MS = 60 * 60 * 1000;

/** Query parameter a tool page is opened with to take the shared files. */
export const SHARED_PARAM = "shared";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => resolve(open.result);
  });
}

function request<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

/** The files waiting from the last share, or an empty list. */
export async function readSharedFiles(): Promise<File[]> {
  try {
    const db = await openDb();
    try {
      const share = (await request(db, "readonly", (store) => store.get(KEY))) as { savedAt: number; files: File[] } | undefined;
      if (!share) return [];
      if (Date.now() - share.savedAt > MAX_AGE_MS) {
        await request(db, "readwrite", (store) => store.delete(KEY));
        return [];
      }
      return share.files;
    } finally {
      db.close();
    }
  } catch {
    return [];
  }
}

/** Deletes the waiting shared files. */
export async function clearSharedFiles(): Promise<void> {
  try {
    const db = await openDb();
    try {
      await request(db, "readwrite", (store) => store.delete(KEY));
    } finally {
      db.close();
    }
  } catch {
    // Nothing stored, or storage blocked: nothing to clear.
  }
}

export type SharedKind = "pdf" | "image" | "docx" | "other";

/** What a shared file is, from its type or name. */
export function sharedKind(file: { name: string; type: string }): SharedKind {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (/^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/.test(name)) return "image";
  if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) return "docx";
  return "other";
}

/**
 * Tools that can open the shared files, most likely first. Files of mixed kinds get no tools:
 * each tool takes one kind.
 *
 * @param files The shared files' names and types.
 */
export function toolsForSharedFiles(files: readonly { name: string; type: string }[]): ToolId[] {
  const kinds = new Set(files.map(sharedKind));
  if (files.length === 0 || kinds.size !== 1) return [];
  const [kind] = kinds;
  const many = files.length > 1;
  if (kind === "pdf") {
    return many
      ? ["merge"]
      : ["edit", "pdf-to-word", "compress", "sign", "fill-form", "translate", "split", "organize", "pdf-to-jpg", "krutidev"];
  }
  if (kind === "image") return many ? ["jpg-to-pdf"] : ["jpg-to-pdf", "resize-image"];
  if (kind === "docx") return many ? [] : ["word-to-pdf", "unicode-to-krutidev"];
  return [];
}
