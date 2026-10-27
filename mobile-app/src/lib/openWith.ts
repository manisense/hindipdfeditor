import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

/** FLAG_GRANT_READ_URI_PERMISSION: lets the chosen app read the shared file. */
const GRANT_READ_URI_PERMISSION = 1;

/**
 * Opens a PDF in another app through the system app picker (Android's resolver for
 * `ACTION_VIEW`, which may open the default PDF app directly). `uri` is a file:// URI
 * (app storage, shared through the app's FileProvider) or a content:// URI (picked via SAF,
 * passed through as is). Rejects when the URI cannot be shared or no app can open PDFs.
 */
export async function openWith(uri: string): Promise<void> {
  const contentUri = uri.startsWith('content://') ? uri : await FileSystem.getContentUriAsync(uri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/pdf',
    flags: GRANT_READ_URI_PERMISSION,
  });
}
