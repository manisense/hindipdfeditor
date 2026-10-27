import * as Sharing from 'expo-sharing';

import { useTx } from '../../i18n';
import { savePdfToPickedDirectory } from '../../lib/savePdf';
import { useRecentFilesStore, type RecentFile } from '../../state/recentFilesStore';
import { useSnackbar } from '../../ui/Snackbar';
import { commonErrors, type ErrorDialogOptions } from '../../ui/useErrorDialog';

/** A tool's output after it passed `verifyPdfOutput`. */
export type SavedFile = {
  uri: string;
  name: string;
  /** Pages in the verified file. */
  pageCount: number;
  /** Size of the verified file, in bytes. */
  sizeBytes: number;
  previewUri?: string;
};

/**
 * Open, Share and Save-a-copy actions for the Saved screen. Open hands the file's Files-list
 * entry to `onOpenFile` (the app opens it in the Reader); failures open the shared error dialog.
 */
export function useSavedFileActions(
  showError: (options: ErrorDialogOptions) => void,
  onOpenFile: (file: RecentFile) => void,
) {
  const tx = useTx();
  const snackbar = useSnackbar();
  const errors = commonErrors(tx);

  const open = (file: SavedFile) => {
    const recent = useRecentFilesStore.getState().files.find((f) => f.uri === file.uri);
    onOpenFile(
      recent ?? {
        id: file.uri,
        name: file.name,
        uri: file.uri,
        sizeBytes: file.sizeBytes,
        pageCount: file.pageCount,
        date: '',
        category: 'downloads',
      },
    );
  };

  const share = async (file: SavedFile) => {
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable');
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: file.name });
    } catch (error) {
      console.warn('Share failed', error);
      showError({ ...errors.share, onRetry: () => void share(file) });
    }
  };

  const saveCopy = async (file: SavedFile) => {
    try {
      const saved = await savePdfToPickedDirectory(file.uri, file.name);
      if (saved) snackbar.show(tx('Saved', 'सेव हो गई'));
    } catch (error) {
      console.warn('Save to folder failed', error);
      showError({ ...errors.save, onRetry: () => void saveCopy(file) });
    }
  };

  return { open, share, saveCopy };
}
