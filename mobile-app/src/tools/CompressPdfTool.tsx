import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { formatFileSize } from '../lib/fileSize';
import { compressPdfFile } from '../lib/pdfOps';
import { getPageCount, renderPage } from '../lib/pdfToImages';
import { verifyPdfOutput } from '../lib/verifyPdf';
import { ToolDoneScreen } from '../screens/ToolDoneScreen';
import { ToolFileRow } from '../screens/tools/ToolFileRow';
import { ToolPickPrompt } from '../screens/tools/ToolPickPrompt';
import { pagesLabel } from '../screens/tools/toolText';
import { useSavedFileActions, type SavedFile } from '../screens/tools/useSavedFileActions';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { Icon } from '../ui/Icon';
import { ListRow } from '../ui/ListRow';
import { ToolScaffold } from '../ui/ToolScaffold';
import { UiText } from '../ui/UiText';
import { commonErrors, useErrorDialog } from '../ui/useErrorDialog';

type SelectedDocument = {
  name: string;
  uri: string;
  pageCount: number;
  /** File size in bytes, when known. */
  size?: number;
  thumbnailUri?: string;
};

type CompressionLevel = 'balanced' | 'strong' | 'high_quality';

/** Render scale per level, in px per PDF point (unchanged from the previous tool). */
const LEVEL_SCALE: Record<CompressionLevel, number> = {
  strong: 1.3,
  balanced: 1.8,
  high_quality: 2.5,
};

/** Loads page count, size and a small first-page thumbnail (thumbnail and size optional). */
async function loadDocument(uri: string, name: string, size?: number): Promise<SelectedDocument> {
  const pageCount = await getPageCount(uri);
  const doc: SelectedDocument = { name, uri, pageCount, size };
  doc.thumbnailUri = await renderPage(uri, 0, 0.5)
    .then((img) => img.uri)
    .catch(() => undefined);
  if (doc.size === undefined) {
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    if (info?.exists && typeof info.size === 'number') doc.size = info.size;
  }
  return doc;
}

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
  onClose: () => void;
  onOpenFile: (file: RecentFile) => void;
};

/** Compress tool: re-renders each page as a JPEG at the chosen level and saves a new PDF. */
export function CompressPdfTool({ initialFileUri, initialFileName, onClose, onOpenFile }: Props) {
  const tx = useTx();
  const ui = useUi();
  const { errorDialog, showError } = useErrorDialog();
  const errors = commonErrors(tx);
  const actions = useSavedFileActions(showError, onOpenFile);
  const addRecentFile = useRecentFilesStore((s) => s.addFile);
  const [document, setDocument] = useState<SelectedDocument | null>(null);
  const [level, setLevel] = useState<CompressionLevel>('balanced');
  const [compressing, setCompressing] = useState(false);
  const [saved, setSaved] = useState<SavedFile | null>(null);
  /** Source size in bytes, for the Saved screen's before → after line. */
  const [originalBytes, setOriginalBytes] = useState(0);

  useEffect(() => {
    if (!initialFileUri) return;
    let isMounted = true;
    loadDocument(initialFileUri, initialFileName ?? 'document.pdf')
      .then((doc) => {
        if (isMounted) setDocument(doc);
      })
      .catch((err) => console.warn('Failed to load initial file in CompressPdfTool', err));
    return () => {
      isMounted = false;
    };
  }, [initialFileUri, initialFileName]);

  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      setDocument(await loadDocument(asset.uri, asset.name, asset.size));
    } catch (error) {
      console.warn('Compress open failed', error);
      showError({ ...errors.open, onRetry: () => void pickPdf() });
    }
  };

  const runCompress = async () => {
    if (!document) return;
    setCompressing(true);
    try {
      const res = await compressPdfFile(document.uri, document.pageCount, LEVEL_SCALE[level]);
      const verified = await verifyPdfOutput(res.uri, document.pageCount);
      const base = document.name.replace(/\.pdf$/i, '');
      const name = `${base}_compressed.pdf`;
      await addRecentFile({
        name,
        hindiName: `${base}_कंप्रेस्ड.pdf`,
        uri: res.uri,
        thumbnailUri: document.thumbnailUri,
        sizeBytes: verified.sizeBytes,
        pageCount: verified.pageCount,
        category: 'downloads',
        starred: false,
      });
      setOriginalBytes(res.originalBytes || document.size || 0);
      setSaved({ uri: res.uri, name, ...verified, previewUri: document.thumbnailUri });
    } catch (error) {
      console.warn('Compression failed', error);
      showError({
        title: tx("Couldn't compress the PDF", 'PDF छोटी नहीं हो सकी'),
        body: tx(
          'The file may be damaged or too large for this phone. Try another level, or another file.',
          'फ़ाइल खराब या इस फ़ोन के लिए बहुत बड़ी हो सकती है। दूसरा लेवल या दूसरी फ़ाइल आज़माएँ।',
        ),
        onRetry: () => void runCompress(),
      });
    } finally {
      setCompressing(false);
    }
  };

  const title = tx('Compress', 'छोटा करें');

  if (saved) {
    return (
      <>
        <ToolDoneScreen
          title={title}
          fileName={saved.name}
          fileUri={saved.uri}
          folderLabel={tx('Files', 'फ़ाइलें')}
          pageCount={saved.pageCount}
          sizeBytes={saved.sizeBytes}
          onOpen={() => actions.open(saved)}
          onShare={() => void actions.share(saved)}
          onSaveCopy={() => void actions.saveCopy(saved)}
          onClose={onClose}
          sizeChange={
            originalBytes > 0 ? { fromBytes: originalBytes, toBytes: saved.sizeBytes } : undefined
          }
          note={
            originalBytes > 0 && saved.sizeBytes >= originalBytes
              ? tx(
                  'This setting made the file bigger. Try Strong or Balanced.',
                  'इस सेटिंग से फ़ाइल बड़ी हो गई। ज़्यादा या संतुलित चुनकर देखें।',
                )
              : undefined
          }
        />
        {errorDialog}
      </>
    );
  }

  const levels: { value: CompressionLevel; label: string; desc: string }[] = [
    {
      value: 'strong',
      label: tx('Strong', 'ज़्यादा'),
      desc: tx('Smallest file, pages look softer', 'सबसे छोटी फ़ाइल, पृष्ठ थोड़े धुंधले'),
    },
    {
      value: 'balanced',
      label: tx('Balanced', 'संतुलित'),
      desc: tx('Good for WhatsApp and email', 'WhatsApp और ईमेल के लिए ठीक'),
    },
    {
      value: 'high_quality',
      label: tx('High quality', 'अच्छी क्वालिटी'),
      desc: tx('Sharper pages, bigger file', 'साफ़ पृष्ठ, बड़ी फ़ाइल'),
    },
  ];

  return (
    <ToolScaffold
      title={title}
      onLeading={onClose}
      primary={
        document
          ? { title, onPress: () => void runCompress(), loading: compressing }
          : { title: tx('Choose a PDF', 'PDF चुनें'), onPress: () => void pickPdf() }
      }
    >
      {!document ? (
        <ToolPickPrompt
          icon="compress"
          iconColor={ui.category.size}
          title={tx('Choose a PDF to make smaller', 'छोटी करने के लिए PDF चुनें')}
          body={tx(
            'A smaller copy is saved as a new file. The original file is not changed.',
            'छोटी कॉपी नई फ़ाइल के रूप में सेव होती है। मूल फ़ाइल नहीं बदलती।',
          )}
        />
      ) : (
        <View>
          <ToolFileRow
            name={document.name}
            meta={[
              pagesLabel(tx, document.pageCount),
              document.size !== undefined ? formatFileSize(document.size) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            thumbnailUri={document.thumbnailUri}
            onChange={() => void pickPdf()}
          />
          <UiText
            variant="meta"
            accessibilityRole="header"
            color={ui.brandOnSurface}
            style={{ fontWeight: '600', paddingTop: 16, paddingHorizontal: 16, paddingBottom: 4 }}
          >
            {tx('How small?', 'कितनी छोटी?')}
          </UiText>
          <View accessibilityRole="radiogroup" accessibilityLabel={tx('How small?', 'कितनी छोटी?')}>
            {levels.map((option) => {
              const selected = option.value === level;
              return (
                <ListRow
                  key={option.value}
                  title={option.label}
                  subtitle={option.desc}
                  onPress={() => setLevel(option.value)}
                  leading={
                    <Icon
                      name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={24}
                      color={selected ? ui.brandOnSurface : ui.inkSecondary}
                      label={selected ? tx('Selected', 'चुना गया') : undefined}
                    />
                  }
                />
              );
            })}
          </View>
          <View
            style={{
              marginTop: 8,
              marginHorizontal: 16,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: ui.fill,
            }}
          >
            <UiText variant="meta" color={ui.inkLabel}>
              {tx(
                "Pages are saved as pictures, so text in the new file can't be selected.",
                'पृष्ठ तस्वीर के रूप में सेव होते हैं, इसलिए नई फ़ाइल का टेक्स्ट चुना नहीं जा सकेगा।',
              )}
            </UiText>
          </View>
        </View>
      )}
      {errorDialog}
    </ToolScaffold>
  );
}
