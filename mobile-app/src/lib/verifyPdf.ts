import { PDFDocument } from '@cantoo/pdf-lib';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Parse-back check for a tool's output before the app reports success (AGENTS.md: "validate
 * before reporting success"). Confirms the file exists, is non-empty, re-parses with
 * `@cantoo/pdf-lib`, and, when `expectedPageCount` (a count, unitless) is given, has that many
 * pages. Callers omit it only when a source's page count could not be read.
 *
 * @returns `sizeBytes` (bytes) and `pageCount` (pages) of the verified file.
 */
export async function verifyPdfOutput(
  uri: string,
  expectedPageCount?: number,
): Promise<{ sizeBytes: number; pageCount: number }> {
  const info = await FileSystem.getInfoAsync(uri);
  const sizeBytes = info.exists && typeof info.size === 'number' ? info.size : 0;
  if (sizeBytes === 0) {
    throw new Error(`verifyPdfOutput: output file at ${uri} is missing or empty`);
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  let pageCount: number;
  try {
    pageCount = (await PDFDocument.load(base64)).getPageCount();
  } catch (cause) {
    throw new Error(`verifyPdfOutput: output file at ${uri} could not be re-parsed as a PDF`, {
      cause,
    });
  }
  if (expectedPageCount !== undefined && pageCount !== expectedPageCount) {
    throw new Error(
      `verifyPdfOutput: expected ${expectedPageCount} page(s), found ${pageCount} in ${uri}`,
    );
  }
  return { sizeBytes, pageCount };
}
