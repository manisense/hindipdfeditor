import { useEffect, useState } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { formatFileSize } from '../lib/fileSize';
import { extractPdfPages, splitPdfFile } from '../lib/pdfOps';
import { getPageCount, renderPage } from '../lib/pdfToImages';
import { persistOutput } from '../lib/persistOutput';
import { ToolDoneScreen } from '../screens/ToolDoneScreen';
import { ToolFileRow } from '../screens/tools/ToolFileRow';
import { ToolPickPrompt } from '../screens/tools/ToolPickPrompt';
import { pagesLabel } from '../screens/tools/toolText';
import { useSavedFileActions, type SavedFile } from '../screens/tools/useSavedFileActions';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { Icon } from '../ui/Icon';
import { PillButton } from '../ui/PillButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ToolScaffold } from '../ui/ToolScaffold';
import { UiText } from '../ui/UiText';
import { commonErrors, useErrorDialog } from '../ui/useErrorDialog';

type SelectedDocument = {
  name: string;
  uri: string;
  pageCount: number;
  /** File size in bytes, when known. */
  size?: number;
  pageImages: string[];
};

type SplitMode = 'all' | 'range' | 'custom';

const GRID_COLUMNS = 4;
const GRID_GAP = 10;

/** Loads page count, size and one thumbnail per page (scale 1 px per pt). */
async function loadDocument(uri: string, name: string, size?: number): Promise<SelectedDocument> {
  const pageCount = await getPageCount(uri);
  const pageImages: string[] = [];
  for (let i = 0; i < pageCount; i++) {
    pageImages.push((await renderPage(uri, i, 1)).uri);
  }
  let bytes = size;
  if (bytes === undefined) {
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    if (info?.exists && typeof info.size === 'number') bytes = info.size;
  }
  return { name, uri, pageCount, size: bytes, pageImages };
}

/** Parses a 1-based page field; NaN when empty or not a number. */
function parsePage(value: string): number {
  return parseInt(value, 10);
}

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
  onClose: () => void;
  onOpenFile: (file: RecentFile) => void;
};

export function SplitPdfTool({ initialFileUri, initialFileName, onClose, onOpenFile }: Props) {
  const tx = useTx();
  const ui = useUi();
  const { errorDialog, showError } = useErrorDialog();
  const errors = commonErrors(tx);
  const actions = useSavedFileActions(showError, onOpenFile);
  const addRecentFile = useRecentFilesStore((s) => s.addFile);
  const [document, setDocument] = useState<SelectedDocument | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [splitMode, setSplitMode] = useState<SplitMode>('all');
  const [fromPage, setFromPage] = useState('1');
  const [toPage, setToPage] = useState('1');
  const [splitting, setSplitting] = useState(false);
  const [saved, setSaved] = useState<SavedFile | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

  const applyDocument = (doc: SelectedDocument) => {
    setDocument(doc);
    setFromPage('1');
    setToPage(String(doc.pageCount));
    setSelectedPages(new Set(Array.from({ length: doc.pageCount }, (_, i) => i)));
    setSplitMode('all');
  };

  useEffect(() => {
    if (!initialFileUri) return;
    let isMounted = true;
    loadDocument(initialFileUri, initialFileName ?? 'document.pdf')
      .then((doc) => {
        if (isMounted) applyDocument(doc);
      })
      .catch((err) => console.warn('Failed to load initial file in SplitPdfTool', err));
    return () => {
      isMounted = false;
    };
  }, [initialFileUri, initialFileName]);

  const pickPdf = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      applyDocument(await loadDocument(asset.uri, asset.name, asset.size));
    } catch (error) {
      console.warn('Split open failed', error);
      showError({ ...errors.open, onRetry: () => void pickPdf() });
    }
  };

  const togglePage = (pageIdx: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageIdx)) next.delete(pageIdx);
      else next.add(pageIdx);
      return next;
    });
  };

  const selectAll = () => {
    if (!document) return;
    setSelectedPages(new Set(Array.from({ length: document.pageCount }, (_, i) => i)));
  };

  const from = parsePage(fromPage);
  const to = parsePage(toPage);
  const rangeValid =
    !!document &&
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= 1 &&
    to <= document.pageCount &&
    from <= to;
  const chosenCount = !document
    ? 0
    : splitMode === 'all'
      ? document.pageCount
      : splitMode === 'range'
        ? rangeValid
          ? to - from + 1
          : 0
        : selectedPages.size;

  const runSplit = async () => {
    if (!document || chosenCount === 0) return;
    setSplitting(true);
    try {
      const base = document.name.replace(/\.pdf$/i, '');
      let outUri: string;
      let thumbnailUri: string | undefined;
      let name: string;
      if (splitMode === 'range') {
        outUri = await splitPdfFile(document.uri, from, to);
        thumbnailUri = document.pageImages[from - 1];
        name = `${base}_p${from}-p${to}.pdf`;
      } else if (splitMode === 'custom') {
        const sorted = Array.from(selectedPages).sort((a, b) => a - b);
        outUri = await extractPdfPages(document.uri, sorted);
        thumbnailUri = document.pageImages[sorted[0]];
        name = `${base}_pages_${sorted.map((p) => p + 1).join('-')}.pdf`;
      } else {
        const allIndices = Array.from({ length: document.pageCount }, (_, i) => i);
        outUri = await extractPdfPages(document.uri, allIndices);
        thumbnailUri = document.pageImages[0];
        name = `${base}_extracted.pdf`;
      }
      const output = await persistOutput(outUri, 'Split', name, chosenCount);
      await addRecentFile({
        name: output.name,
        hindiName: `${base}_विभाजित.pdf`,
        uri: output.uri,
        thumbnailUri,
        sizeBytes: output.sizeBytes,
        pageCount: output.pageCount,
        category: 'downloads',
        starred: false,
      });
      setSaved({ ...output, previewUri: thumbnailUri });
    } catch (error) {
      console.warn('Split failed', error);
      showError({
        title: tx("Couldn't split the PDF", 'PDF अलग नहीं हो सकी'),
        body: tx(
          'The file may be locked or damaged. Check the file, then try again.',
          'फ़ाइल लॉक या खराब हो सकती है। फ़ाइल जाँचें, फिर से करें।',
        ),
        onRetry: () => void runSplit(),
      });
    } finally {
      setSplitting(false);
    }
  };

  const title = tx('Split PDF', 'PDF अलग करें');

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

  const cellWidth = gridWidth > 0 ? (gridWidth - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS : 0;
  const pageInputStyle = {
    width: 64,
    height: 48,
    borderRadius: 12,
    backgroundColor: ui.fill,
    color: ui.ink,
    textAlign: 'center' as const,
    fontSize: 16,
  };

  return (
    <ToolScaffold
      title={title}
      onLeading={onClose}
      primary={
        document
          ? {
              title: tx(
                `Save ${chosenCount} pages as a new PDF`,
                `${chosenCount} पृष्ठ नई PDF में सेव करें`,
              ),
              onPress: () => void runSplit(),
              disabled: chosenCount === 0,
              loading: splitting,
            }
          : { title: tx('Choose a PDF', 'PDF चुनें'), onPress: () => void pickPdf() }
      }
    >
      {!document ? (
        <ToolPickPrompt
          icon="call-split"
          iconColor={ui.category.pages}
          title={tx('Choose a PDF to split', 'अलग करने के लिए PDF चुनें')}
          body={tx(
            'Save some of its pages as a new PDF. The original file is not changed.',
            'इसके कुछ पृष्ठ नई PDF में सेव करें। मूल फ़ाइल नहीं बदलती।',
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
            thumbnailUri={document.pageImages[0]}
            onChange={() => void pickPdf()}
          />
          <View style={{ marginTop: 8, marginHorizontal: 16 }}>
            <SegmentedControl
              label={tx('Pages to save', 'सेव करने वाले पृष्ठ')}
              value={splitMode}
              onChange={setSplitMode}
              options={[
                { value: 'all', label: tx('All pages', 'सभी पृष्ठ') },
                { value: 'range', label: tx('Range', 'रेंज') },
                { value: 'custom', label: tx('Pick pages', 'पृष्ठ चुनें') },
              ]}
            />
          </View>

          {splitMode === 'range' ? (
            <View style={{ padding: 16, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <UiText variant="body">{tx('From', 'से')}</UiText>
                <TextInput
                  accessibilityLabel={tx('From page', 'शुरू का पृष्ठ')}
                  value={fromPage}
                  onChangeText={setFromPage}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  style={pageInputStyle}
                />
                <UiText variant="body">{tx('to', 'तक')}</UiText>
                <TextInput
                  accessibilityLabel={tx('To page', 'आख़िरी पृष्ठ')}
                  value={toPage}
                  onChangeText={setToPage}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  style={pageInputStyle}
                />
              </View>
              <UiText variant="meta" color={rangeValid ? ui.inkSecondary : ui.danger}>
                {tx(
                  `Pages 1 to ${document.pageCount}. The first page must come before the last.`,
                  `पृष्ठ 1 से ${document.pageCount} तक। पहला पृष्ठ आख़िरी से पहले होना चाहिए।`,
                )}
              </UiText>
            </View>
          ) : null}

          {splitMode === 'custom' ? (
            <View>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 16,
                  paddingBottom: 4,
                  paddingLeft: 16,
                  paddingRight: 8,
                }}
              >
                <UiText variant="meta" color={ui.inkSecondary}>
                  {tx(
                    `${selectedPages.size} of ${document.pageCount} pages chosen`,
                    `${document.pageCount} में से ${selectedPages.size} पृष्ठ चुने`,
                  )}
                </UiText>
                <PillButton kind="text" title={tx('Select all', 'सभी चुनें')} onPress={selectAll} />
              </View>
              <View
                onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: GRID_GAP,
                  marginHorizontal: 16,
                  paddingTop: 4,
                  paddingBottom: 16,
                }}
              >
                {cellWidth > 0
                  ? document.pageImages.map((imageUri, idx) => {
                      const selected = selectedPages.has(idx);
                      return (
                        <Pressable
                          key={idx}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          accessibilityLabel={tx(`Page ${idx + 1}`, `पृष्ठ ${idx + 1}`)}
                          onPress={() => togglePage(idx)}
                          style={{ width: cellWidth, alignItems: 'center', gap: 4 }}
                        >
                          <View
                            style={{
                              width: cellWidth,
                              height: cellWidth * 1.414,
                              borderRadius: 4,
                              backgroundColor: '#FFFFFF',
                              borderWidth: selected ? 3 : 1,
                              borderColor: selected ? ui.brand : ui.ring,
                              overflow: 'hidden',
                            }}
                          >
                            <Image
                              source={{ uri: imageUri }}
                              style={{ width: '100%', height: '100%' }}
                              resizeMode="contain"
                            />
                            <View
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                borderRadius: 9999,
                                backgroundColor: '#FFFFFF',
                              }}
                            >
                              <Icon
                                name={selected ? 'check-circle' : 'radio-button-unchecked'}
                                size={20}
                                color={selected ? ui.brand : '#A1A1AA'}
                              />
                            </View>
                          </View>
                          <UiText variant="label" color={ui.inkLabel}>
                            {idx + 1}
                          </UiText>
                        </Pressable>
                      );
                    })
                  : null}
              </View>
            </View>
          ) : null}
        </View>
      )}
      {errorDialog}
    </ToolScaffold>
  );
}
