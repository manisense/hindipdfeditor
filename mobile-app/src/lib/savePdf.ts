import { PDFDocument } from '@cantoo/pdf-lib';
import * as FileSystem from 'expo-file-system/legacy';

const PDF_MIME_TYPE = 'application/pdf';

function safeBaseName(filename: string): string {
  const withoutExtension = filename.replace(/\.pdf$/i, '');
  const sanitized = withoutExtension.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim();
  return sanitized || 'Hindi-PDF-edited';
}

/**
 * Opens Android's system directory picker, writes a validated copy of `sourceUri` into the
 * selected File Manager folder, and returns the new `content://` URI. Returns `null` when the
 * user cancels the picker. The source/export cache file is never moved or overwritten.
 */
export async function savePdfToPickedDirectory(
  sourceUri: string,
  suggestedFilename: string,
): Promise<string | null> {
  const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permission.granted) return null;

  const destinationUri = await FileSystem.StorageAccessFramework.createFileAsync(
    permission.directoryUri,
    `${safeBaseName(suggestedFilename)}.pdf`,
    PDF_MIME_TYPE,
  );
  try {
    const sourceBase64 = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.StorageAccessFramework.writeAsStringAsync(destinationUri, sourceBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const persistedBase64 = await FileSystem.StorageAccessFramework.readAsStringAsync(
      destinationUri,
      { encoding: FileSystem.EncodingType.Base64 },
    );
    const parsed = await PDFDocument.load(persistedBase64);
    if (parsed.getPageCount() === 0) {
      throw new Error('Saved PDF contains no pages');
    }
    return destinationUri;
  } catch (cause) {
    await FileSystem.StorageAccessFramework.deleteAsync(destinationUri, { idempotent: true }).catch(
      () => {},
    );
    throw new Error('The PDF could not be validated after saving to the selected folder', {
      cause,
    });
  }
}
