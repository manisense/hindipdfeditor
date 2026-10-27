import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { formatFileSize } from '../lib/fileSize';
import { mergePdfFiles } from '../lib/pdfOps';
import { getPageCount, renderPage } from '../lib/pdfToImages';
import { moveItem } from '../lib/reorder';
import { persistOutput } from '../lib/persistOutput';
import { ToolDoneScreen } from '../screens/ToolDoneScreen';
import { PageThumb } from '../screens/tools/PageThumb';
import { SortableList } from '../screens/tools/SortableList';
import { ToolPickPrompt } from '../screens/tools/ToolPickPrompt';
import { pagesLabel } from '../screens/tools/toolText';
import { useSavedFileActions, type SavedFile } from '../screens/tools/useSavedFileActions';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { Icon } from '../ui/Icon';
import { PillButton } from '../ui/PillButton';
import { ToolScaffold } from '../ui/ToolScaffold';
import { UiText } from '../ui/UiText';
import { useErrorDialog } from '../ui/useErrorDialog';

const ROW_HEIGHT = 76;

type MergeItem = {
  id: string;
  name: string;
  uri: string;
  thumbnailUri?: string;
  /** Pages in the file; undefined when the renderer could not read it. */
  pageCount?: number;
  /** File size in bytes, when known. */
  size?: number;
};

/** Display name for a merged output, suffixed with the last 4 digits of the current ms time. */
function mergedOutputName(): string {
  return `Merged_${Date.now().toString().slice(-4)}.pdf`;
}

/** Random-suffixed id for a queued merge item. */
function newMergeItemId(): string {
  return `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Reads page count, size and a first-page thumbnail; each part is optional. */
async function describeFile(uri: string, name: string, size?: number): Promise<MergeItem> {
  const item: MergeItem = { id: newMergeItemId(), name, uri, size };
  try {
    item.pageCount = await getPageCount(uri);
    item.thumbnailUri = (await renderPage(uri, 0, 0.5)).uri;
  } catch {
    // Unreadable here; pdf-lib may still merge it, and the merge reports any real failure.
  }
  if (item.size === undefined) {
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    if (info?.exists && typeof info.size === 'number') item.size = info.size;
  }
  return item;
}

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
  onClose: () => void;
  onOpenFile: (file: RecentFile) => void;
};

export function MergePdfTool({ initialFileUri, initialFileName, onClose, onOpenFile }: Props) {
  const tx = useTx();
  const ui = useUi();
  const theme = useAppTheme();
  const { errorDialog, showError } = useErrorDialog();
  const actions = useSavedFileActions(showError, onOpenFile);
  const addRecentFile = useRecentFilesStore((s) => s.addFile);
  const [files, setFiles] = useState<MergeItem[]>([]);
  const [merging, setMerging] = useState(false);
  const [saved, setSaved] = useState<SavedFile | null>(null);

  useEffect(() => {
    if (!initialFileUri) return;
    let isMounted = true;
    describeFile(initialFileUri, initialFileName ?? 'document.pdf')
      .then((item) => {
        if (isMounted) setFiles([item]);
      })
      .catch((err) => console.warn('Failed to load initial file in MergePdfTool', err));
    return () => {
      isMounted = false;
    };
  }, [initialFileUri, initialFileName]);

  const pickMoreFiles = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const newItems: MergeItem[] = [];
      for (const asset of res.assets) {
        newItems.push(await describeFile(asset.uri, asset.name, asset.size));
      }
      setFiles((prev) => [...prev, ...newItems]);
    } catch (error) {
      console.warn('Merge file pick failed', error);
      showError({
        title: tx("Couldn't add the files", 'फ़ाइलें नहीं जुड़ सकीं'),
        body: tx(
          'The file picker closed with an error. Try picking the PDFs again.',
          'फ़ाइल चुनते समय गड़बड़ी हुई। PDF फिर से चुनें।',
        ),
        onRetry: () => void pickMoreFiles(),
      });
    }
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const move = (from: number, to: number) => setFiles((prev) => moveItem(prev, from, to));

  const runMerge = async () => {
    if (files.length < 2) return;
    setMerging(true);
    try {
      const outUri = await mergePdfFiles(files.map((f) => f.uri));
      const allCounted = files.every((f) => f.pageCount !== undefined);
      const expectedPages = allCounted
        ? files.reduce((acc, f) => acc + (f.pageCount ?? 0), 0)
        : undefined;
      const output = await persistOutput(outUri, 'Merged', mergedOutputName(), expectedPages);
      await addRecentFile({
        name: output.name,
        hindiName: 'मर्ज_दस्तावेज़.pdf',
        uri: output.uri,
        thumbnailUri: files[0]?.thumbnailUri,
        sizeBytes: output.sizeBytes,
        pageCount: output.pageCount,
        category: 'downloads',
        starred: false,
      });
      setSaved({ ...output, previewUri: files[0]?.thumbnailUri });
    } catch (error) {
      console.warn('Merge failed', error);
      showError({
        title: tx("Couldn't merge the PDFs", 'PDF नहीं जुड़ सकीं'),
        body: tx(
          'One of the files may be locked or damaged. Check the files, then try again.',
          'कोई फ़ाइल लॉक या खराब हो सकती है। फ़ाइलें जाँचें, फिर से करें।',
        ),
        onRetry: () => void runMerge(),
      });
    } finally {
      setMerging(false);
    }
  };

  const title = tx('Merge PDFs', 'PDF जोड़ें');

  if (saved) {
    return (
      <>
        <ToolDoneScreen
          title={title}
          fileName={saved.name}
          fileUri={saved.uri}
          pageCount={saved.pageCount}
          sizeBytes={saved.sizeBytes}
          previewUri={saved.previewUri}
          onOpen={() => actions.open(saved)}
          onShare={() => void actions.share(saved)}
          onSaveCopy={() => void actions.saveCopy(saved)}
          onClose={onClose}
        />
        {errorDialog}
      </>
    );
  }

  const n = files.length;
  const totalPages = files.reduce((acc, f) => acc + (f.pageCount ?? 0), 0);

  return (
    <ToolScaffold
      title={title}
      onLeading={onClose}
      primary={
        n === 0
          ? { title: tx('Choose PDFs', 'PDF चुनें'), onPress: () => void pickMoreFiles() }
          : {
              title: tx(`Merge ${n} PDFs`, `${n} PDF जोड़ें`),
              onPress: () => void runMerge(),
              disabled: n < 2,
              loading: merging,
            }
      }
    >
      {n === 0 ? (
        <ToolPickPrompt
          icon="merge-type"
          iconColor={ui.category.pages}
          title={tx('Choose the PDFs to join', 'जोड़ने के लिए PDF चुनें')}
          body={tx(
            'Pick two or more files. You can change the order before merging.',
            'दो या ज़्यादा फ़ाइलें चुनें। जोड़ने से पहले क्रम बदल सकते हैं।',
          )}
        />
      ) : (
        <View>
          <UiText
            variant="meta"
            color={ui.inkSecondary}
            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
          >
            {tx(
              `${n} files · ${totalPages} pages · hold and drag to change the order`,
              `${n} फ़ाइलें · ${totalPages} पृष्ठ · क्रम बदलने के लिए दबाकर खींचें`,
            )}
          </UiText>
          <SortableList
            items={files}
            keyOf={(f) => f.id}
            rowHeight={ROW_HEIGHT}
            onMove={move}
            renderRow={(file, index, { dragging, renderHandle }) => {
              const meta = [
                file.pageCount !== undefined ? pagesLabel(tx, file.pageCount) : null,
                file.size !== undefined ? formatFileSize(file.size) : null,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <View
                  accessible
                  accessibilityLabel={meta ? `${file.name}, ${meta}` : file.name}
                  accessibilityActions={[
                    { name: 'moveUp', label: tx('Move up', 'ऊपर ले जाएँ') },
                    { name: 'moveDown', label: tx('Move down', 'नीचे ले जाएँ') },
                    { name: 'remove', label: tx('Remove', 'हटाएँ') },
                  ]}
                  onAccessibilityAction={(event) => {
                    const action = event.nativeEvent.actionName;
                    if (action === 'moveUp' && index > 0) move(index, index - 1);
                    if (action === 'moveDown' && index < n - 1) move(index, index + 1);
                    if (action === 'remove') removeFile(file.id);
                  }}
                  style={{
                    height: ROW_HEIGHT,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingLeft: dragging ? 8 : 16,
                    paddingRight: 4,
                    marginHorizontal: dragging ? 8 : 0,
                    borderRadius: dragging ? 16 : 0,
                    backgroundColor: theme.colors.surface,
                  }}
                >
                  <PageThumb uri={file.thumbnailUri} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <UiText variant="body" numberOfLines={1}>
                      {file.name}
                    </UiText>
                    {meta ? (
                      <UiText variant="meta" color={ui.inkSecondary} numberOfLines={1}>
                        {meta}
                      </UiText>
                    ) : null}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tx(`Remove ${file.name}`, `${file.name} हटाएँ`)}
                    onPress={() => removeFile(file.id)}
                    android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: true, radius: 24 }}
                    style={{
                      width: 48,
                      height: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="close" size={20} color={ui.inkTertiary} />
                  </Pressable>
                  {renderHandle(
                    <View
                      accessibilityLabel={tx(
                        `Hold and drag to move ${file.name}`,
                        `${file.name} को खिसकाने के लिए दबाकर खींचें`,
                      )}
                      style={{
                        width: 48,
                        height: 48,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon
                        name="drag-indicator"
                        size={24}
                        color={dragging ? ui.brand : ui.inkTertiary}
                      />
                    </View>,
                  )}
                </View>
              );
            }}
          />
          {n < 2 ? (
            <UiText
              variant="meta"
              color={ui.inkSecondary}
              style={{ paddingHorizontal: 16, paddingTop: 8 }}
            >
              {tx('Add at least 2 files', 'कम से कम 2 फ़ाइलें जोड़ें')}
            </UiText>
          ) : null}
          <View style={{ marginTop: 8, marginHorizontal: 8, alignSelf: 'flex-start' }}>
            <PillButton
              kind="text"
              icon="add"
              title={tx('Add more files', 'और फ़ाइलें जोड़ें')}
              onPress={() => void pickMoreFiles()}
            />
          </View>
        </View>
      )}
      {errorDialog}
    </ToolScaffold>
  );
}
