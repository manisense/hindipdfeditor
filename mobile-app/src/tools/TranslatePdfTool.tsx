import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { TranslationDirection } from '@hindipdfeditor/translation-contract';

import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { ptSizeToImagePx, ptToImagePx } from '../lib/coordinateMath';
import { exportPdf } from '../lib/exportPdf';
import { formatFileSize } from '../lib/fileSize';
import { fontFaceWeight, getFontBase64, type DevanagariFontFamily } from '../lib/fontAsset';
import { containsDevanagari, containsLatin, translateOcrLines } from '../lib/geminiTranslate';
import { detectTextLines } from '../lib/ocr';
import { getPageCount, renderPage, sampleAverageColor } from '../lib/pdfToImages';
import { geometryForTranslatedLine, successfulTranslations } from '../lib/translateEdits';
import { verifyPdfOutput } from '../lib/verifyPdf';
import { ToolDoneScreen } from '../screens/ToolDoneScreen';
import { ToolFileRow } from '../screens/tools/ToolFileRow';
import { ToolPickPrompt } from '../screens/tools/ToolPickPrompt';
import { pagesLabel } from '../screens/tools/toolText';
import { useSavedFileActions, type SavedFile } from '../screens/tools/useSavedFileActions';
import type { DocumentState, PageState } from '../state/editStore';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { Icon } from '../ui/Icon';
import { PillButton } from '../ui/PillButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import { ToolScaffold } from '../ui/ToolScaffold';
import { uiDark } from '../ui/tokens';
import { UiText } from '../ui/UiText';
import { commonErrors, useErrorDialog } from '../ui/useErrorDialog';

type SelectedDocument = {
  name: string;
  uri: string;
  pageCount: number;
  /** File size in bytes, when known. */
  size?: number;
};

/** Where the run is; mapped to a translated message and a progress fraction. */
type Progress =
  | { step: 'reading'; page: number; total: number }
  | { step: 'detecting'; page: number; total: number }
  | { step: 'translating'; page: number; total: number; lines: number }
  | { step: 'assembling'; total: number };

/** Thrown between pages after the person taps Cancel; never shown as an error. */
class TranslationCancelled extends Error {}

/** Progress fraction 0..1: reading is the first half of the work, OCR and translation the rest. */
function progressFraction(progress: Progress): number {
  if (progress.step === 'assembling') return 0.95;
  const done = progress.step === 'reading' ? progress.page - 1 : progress.total + progress.page - 1;
  return Math.min(0.95, done / (progress.total * 2));
}

/** Loads page count and size. */
async function loadDocument(uri: string, name: string, size?: number): Promise<SelectedDocument> {
  const pageCount = await getPageCount(uri);
  let bytes = size;
  if (bytes === undefined) {
    const info = await FileSystem.getInfoAsync(uri).catch(() => null);
    if (info?.exists && typeof info.size === 'number') bytes = info.size;
  }
  return { name, uri, pageCount, size: bytes };
}

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
  onClose: () => void;
  onOpenFile: (file: RecentFile) => void;
};

/**
 * Translate tool: reads each page, finds text, translates it online and exports a new PDF
 * through the Plan A HTML/print pipeline (`exportPdf`). Cancel stops between pages.
 */
export function TranslatePdfTool({ initialFileUri, initialFileName, onClose, onOpenFile }: Props) {
  const tx = useTx();
  const ui = useUi();
  const { errorDialog, showError } = useErrorDialog();
  const errors = commonErrors(tx);
  const actions = useSavedFileActions(showError, onOpenFile);
  const addRecentFile = useRecentFilesStore((s) => s.addFile);
  const [selectedDoc, setSelectedDoc] = useState<SelectedDocument | null>(null);
  const [direction, setDirection] = useState<TranslationDirection>('hi-en');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [saved, setSaved] = useState<SavedFile | null>(null);
  const aiJobIdRef = useRef(`translate-${Crypto.randomUUID()}`);
  /** Id of the run that may still update the screen; Cancel and unmount bump it. */
  const runIdRef = useRef(0);

  useEffect(() => {
    if (!initialFileUri) return;
    let isMounted = true;
    loadDocument(initialFileUri, initialFileName ?? 'document.pdf')
      .then((doc) => {
        if (!isMounted) return;
        setSelectedDoc(doc);
        aiJobIdRef.current = `translate-${Crypto.randomUUID()}`;
      })
      .catch((err) => console.warn('Failed to load initial file in TranslatePdfTool', err));
    return () => {
      isMounted = false;
    };
  }, [initialFileUri, initialFileName]);

  // Stop a running translation if the tool goes away.
  useEffect(
    () => () => {
      runIdRef.current += 1;
    },
    [],
  );

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      setSelectedDoc(await loadDocument(asset.uri, asset.name, asset.size));
      aiJobIdRef.current = `translate-${Crypto.randomUUID()}`;
    } catch (error) {
      console.warn('Translate open failed', error);
      showError({ ...errors.open, onRetry: () => void pickPdf() });
    }
  };

  const runTranslation = async () => {
    if (!selectedDoc) return;
    runIdRef.current += 1;
    const runId = runIdRef.current;
    // Checked between pages: a cancelled run stops at the next page and never touches the screen.
    const throwIfCancelled = () => {
      if (runIdRef.current !== runId) throw new TranslationCancelled();
    };
    const total = selectedDoc.pageCount;
    setProgress({ step: 'reading', page: 1, total });
    try {
      // 1. Rasterize pages
      const pages: PageState[] = [];
      for (let i = 0; i < total; i++) {
        throwIfCancelled();
        setProgress({ step: 'reading', page: i + 1, total });
        const img = await renderPage(selectedDoc.uri, i, 3);
        pages.push({
          pageIndex: i,
          widthPt: img.widthPt,
          heightPt: img.heightPt,
          backgroundImageUri: img.uri,
          imagePxWidth: img.pxWidth,
          imagePxHeight: img.pxHeight,
          edits: [],
          ocrLines: [],
        });
      }

      // 2. Perform OCR and translation for each page
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        throwIfCancelled();
        const pageState = pages[pageIndex];
        setProgress({ step: 'detecting', page: pageIndex + 1, total });

        let lines: PageState['ocrLines'] = [];
        try {
          lines = await detectTextLines(pageState);
        } catch {
          lines = [];
        }
        throwIfCancelled();

        // Filter lines matching source direction
        const translatable = lines.filter((l) =>
          direction === 'hi-en' ? containsDevanagari(l.text) : containsLatin(l.text),
        );

        if (translatable.length > 0) {
          setProgress({
            step: 'translating',
            page: pageIndex + 1,
            total,
            lines: translatable.length,
          });
          // Last check before page text goes online: no request starts after Cancel.
          throwIfCancelled();
          const translationMap = await translateOcrLines(
            aiJobIdRef.current,
            direction,
            translatable.map((l) => ({ id: l.id, page: pageIndex, text: l.text })),
          );

          const successful = successfulTranslations(lines, translationMap);

          // Commit masks and translated text overlays
          for (const item of successful) {
            const geom = geometryForTranslatedLine(
              item.line,
              pageState.widthPt,
              pageState.heightPt,
            );
            const { x: xPx, y: yPx } = ptToImagePx(
              geom.mask.xPt,
              geom.mask.yPt,
              pageState.imagePxWidth,
              pageState.widthPt,
            );
            const { wPx, hPx } = ptSizeToImagePx(
              geom.mask.wPt,
              geom.mask.hPt,
              pageState.imagePxWidth,
              pageState.widthPt,
            );
            const maskColor = await sampleAverageColor(
              pageState.backgroundImageUri,
              xPx,
              yPx,
              wPx,
              hPx,
              16,
            ).catch(() => '#ffffff');

            const maskId = `mask-${Crypto.randomUUID()}`;
            const textId = `text-${Crypto.randomUUID()}`;

            pageState.edits.push({
              type: 'mask',
              id: maskId,
              page: pageIndex,
              xPt: geom.mask.xPt,
              yPt: geom.mask.yPt,
              wPt: geom.mask.wPt,
              hPt: geom.mask.hPt,
              color: maskColor,
            });

            pageState.edits.push({
              type: 'text',
              id: textId,
              page: pageIndex,
              xPt: geom.text.xPt,
              yPt: geom.text.yPt,
              fontSizePt: geom.text.fontSizePt,
              text: item.translated,
              color: '#15172C',
              fontFamily: 'NotoSansDevanagari',
              widthPt: geom.text.widthPt,
              fontWeight: geom.text.fontWeight,
              replacement: { maskId, ocrLine: item.line },
            });
          }
        }
      }

      // 3. Assemble and export the translated PDF
      throwIfCancelled();
      setProgress({ step: 'assembling', total });
      const usedFamilies = new Set<DevanagariFontFamily>(['NotoSansDevanagari']);
      for (const p of pages) {
        for (const e of p.edits) {
          if (e.type === 'text' && e.fontFamily) {
            usedFamilies.add(e.fontFamily);
          }
        }
      }

      const embeddedFonts: Record<string, { base64: string; cssFontWeight: '100 900' | '400' }> =
        {};
      for (const family of usedFamilies) {
        throwIfCancelled();
        const base64 = await getFontBase64(family);
        embeddedFonts[family] = {
          base64,
          cssFontWeight: fontFaceWeight(family),
        };
      }

      const docState: DocumentState = {
        sourceUri: selectedDoc.uri,
        displayName: selectedDoc.name,
        pageCount: pages.length,
        pages,
        legacyFontWarnings: [],
      };

      // exportPdf runs its own parse-back check (page count and sizes) before returning.
      const resultPdf = await exportPdf(docState, embeddedFonts);
      throwIfCancelled();
      const verified = await verifyPdfOutput(resultPdf, pages.length);

      const base = selectedDoc.name.replace(/\.pdf$/i, '');
      const name = `${base}_${direction === 'hi-en' ? 'English' : 'Hindi'}.pdf`;
      throwIfCancelled();
      await addRecentFile({
        name,
        hindiName: `${base}_अनुवादित.pdf`,
        uri: resultPdf,
        thumbnailUri: pages[0]?.backgroundImageUri,
        sizeBytes: verified.sizeBytes,
        pageCount: verified.pageCount,
        category: 'downloads',
        starred: false,
      });
      setSaved({ uri: resultPdf, name, ...verified });
    } catch (error) {
      if (error instanceof TranslationCancelled || runIdRef.current !== runId) return;
      console.warn('Translation failed', error);
      showError({
        title: tx("Couldn't translate the PDF", 'PDF का अनुवाद नहीं हो सका'),
        body: tx(
          'The translation stopped partway. Check your internet connection, then try again.',
          'अनुवाद बीच में रुक गया। इंटरनेट कनेक्शन जाँचें, फिर से करें।',
        ),
        onRetry: () => void runTranslation(),
      });
    } finally {
      if (runIdRef.current === runId) setProgress(null);
    }
  };

  const cancel = () => {
    runIdRef.current += 1;
    setProgress(null);
  };

  const title = tx('Translate', 'अनुवाद');

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
        />
        {errorDialog}
      </>
    );
  }

  if (progress) {
    const message =
      progress.step === 'reading'
        ? tx(
            `Reading page ${progress.page} of ${progress.total}`,
            `पृष्ठ ${progress.page} / ${progress.total} पढ़ा जा रहा है`,
          )
        : progress.step === 'detecting'
          ? tx(
              `Detecting text on page ${progress.page}`,
              `पृष्ठ ${progress.page} पर टेक्स्ट ढूँढ़ा जा रहा है`,
            )
          : progress.step === 'translating'
            ? tx(
                `Translating ${progress.lines} lines on page ${progress.page}`,
                `पृष्ठ ${progress.page} की ${progress.lines} पंक्तियों का अनुवाद`,
              )
            : tx('Assembling final translated document', 'अनुवादित फ़ाइल बन रही है');
    const fraction = progressFraction(progress);
    return (
      <ToolScaffold title={title} leadingIcon="close" onLeading={cancel}>
        <View style={{ paddingTop: 96, paddingHorizontal: 32, alignItems: 'center', gap: 12 }}>
          <Icon name="translate" size={48} color={ui.category.translate} />
          <UiText variant="title" accessibilityRole="header" style={{ marginTop: 8 }}>
            {tx('Translating', 'अनुवाद हो रहा है')}
          </UiText>
          <UiText
            variant="body"
            color={ui.inkLabel}
            accessibilityLiveRegion="polite"
            style={{ textAlign: 'center' }}
          >
            {message}
          </UiText>
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
            style={{
              alignSelf: 'stretch',
              height: 6,
              marginTop: 12,
              borderRadius: 9999,
              backgroundColor: ui === uiDark ? ui.fill : '#E4E4E7',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.round(fraction * 100)}%`,
                height: '100%',
                borderRadius: 9999,
                backgroundColor: ui.brand,
              }}
            />
          </View>
          <UiText variant="meta" color={ui.inkSecondary} style={{ marginTop: 12 }}>
            {tx('Keep the app open until it finishes.', 'पूरा होने तक ऐप खुला रखें।')}
          </UiText>
          <PillButton kind="text" title={tx('Cancel', 'रद्द करें')} onPress={cancel} />
        </View>
      </ToolScaffold>
    );
  }

  return (
    <ToolScaffold
      title={title}
      onLeading={onClose}
      primary={
        selectedDoc
          ? { title: tx('Translate', 'अनुवाद करें'), onPress: () => void runTranslation() }
          : { title: tx('Choose a PDF', 'PDF चुनें'), onPress: () => void pickPdf() }
      }
    >
      {!selectedDoc ? (
        <ToolPickPrompt
          icon="translate"
          iconColor={ui.category.translate}
          title={tx('Choose a PDF to translate', 'अनुवाद के लिए PDF चुनें')}
          body={tx(
            'Hindi to English or English to Hindi. The translation is saved as a new PDF.',
            'हिंदी से अंग्रेज़ी या अंग्रेज़ी से हिंदी। अनुवाद नई PDF में सेव होता है।',
          )}
        />
      ) : (
        <View>
          <ToolFileRow
            name={selectedDoc.name}
            meta={[
              pagesLabel(tx, selectedDoc.pageCount),
              selectedDoc.size !== undefined ? formatFileSize(selectedDoc.size) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            onChange={() => void pickPdf()}
          />
          <View style={{ marginTop: 8, marginHorizontal: 16 }}>
            <SegmentedControl
              label={tx('Translate from', 'किस भाषा से')}
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'hi-en', label: tx('Hindi to English', 'हिंदी से अंग्रेज़ी') },
                { value: 'en-hi', label: tx('English to Hindi', 'अंग्रेज़ी से हिंदी') },
              ]}
            />
          </View>
          <View
            style={{
              marginTop: 16,
              marginHorizontal: 16,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: ui.fill,
            }}
          >
            <UiText variant="meta" color={ui.inkLabel}>
              {tx(
                'Text found on the pages is sent online to be translated. Everything else stays on your phone.',
                'पृष्ठों पर मिला टेक्स्ट अनुवाद के लिए ऑनलाइन भेजा जाता है। बाकी सब आपके फ़ोन पर ही रहता है।',
              )}
            </UiText>
          </View>
        </View>
      )}
      {errorDialog}
    </ToolScaffold>
  );
}
