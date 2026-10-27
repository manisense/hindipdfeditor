import * as FileSystem from 'expo-file-system/legacy';

import { outputFileName } from './outputFileName';
import { verifyPdfOutput } from './verifyPdf';

/**
 * Folders in the app's permanent storage (`documentDirectory`) that hold saved outputs, one per
 * tool. Unlike the cache, Android does not clear these under storage pressure or on "Clear
 * cache"; they go only when the app is uninstalled or its data is cleared.
 */
export type OutputFolder = 'Edited' | 'Merged' | 'Split' | 'Compressed' | 'Translated';

/** A saved output: its permanent `file://` URI, plain file name and verified contents. */
export type PersistedOutput = {
  uri: string;
  name: string;
  /** Pages in the saved copy. */
  pageCount: number;
  /** Size of the saved copy, in bytes. */
  sizeBytes: number;
};

/**
 * `fileName` (ending in `.pdf`) with ` (n)` before the extension for the n-th candidate; the
 * first candidate (`n` = 1) is the name unchanged.
 */
export function numberedFileName(fileName: string, n: number): string {
  const base = fileName.replace(/\.pdf$/i, '');
  return `${n === 1 ? base : `${base} (${n})`}.pdf`;
}

/**
 * Copies a tool's temporary output (`tempUri`, in the app cache) into `documentDirectory/<folder>/`
 * under a safe version of `fileName` (`outputFileName`: unsafe characters replaced, capped at
 * 200 UTF-8 bytes), adding ` (2)`, ` (3)`… instead of overwriting an earlier file. The copy then
 * passes `verifyPdfOutput` with `expectedPageCount` (a count, or undefined when unknown).
 *
 * If the copy or the check fails, the copy is deleted and the error is rethrown, so the caller
 * shows an error and never a success. The temporary file is deleted either way (a retry builds a
 * new one), but only when it sits in the app cache, so a source document is never removed.
 */
export async function persistOutput(
  tempUri: string,
  folder: OutputFolder,
  fileName: string,
  expectedPageCount?: number,
): Promise<PersistedOutput> {
  if (!FileSystem.documentDirectory) throw new Error('App storage is unavailable');
  const dir = `${FileSystem.documentDirectory}${folder}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const safeName = outputFileName(fileName, folder.toLowerCase());

  let n = 1;
  let name = safeName;
  let uri = `${dir}${encodeURIComponent(name)}`;
  while ((await FileSystem.getInfoAsync(uri)).exists) {
    n += 1;
    name = numberedFileName(safeName, n);
    uri = `${dir}${encodeURIComponent(name)}`;
  }

  try {
    await FileSystem.copyAsync({ from: tempUri, to: uri });
    const verified = await verifyPdfOutput(uri, expectedPageCount);
    return { uri, name, ...verified };
  } catch (error) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    throw error;
  } finally {
    await discardTemporaryOutput(tempUri);
  }
}

/**
 * Best-effort delete of a tool's temporary output. Does nothing unless `uri` is in the app cache,
 * so it can be called on any URI without risking a source document.
 */
export async function discardTemporaryOutput(uri: string): Promise<void> {
  const cache = FileSystem.cacheDirectory;
  if (!cache || !uri.startsWith(cache)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}
