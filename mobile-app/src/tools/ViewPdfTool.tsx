import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { getPageCount } from '../lib/pdfToImages';
import { readerPageLayout } from '../lib/readerLayout';
import { FileInfoSheet } from '../screens/reader/FileInfoSheet';
import { PageGrid } from '../screens/reader/PageGrid';
import { PageScroller } from '../screens/reader/PageScroller';
import { ReaderMenu, type ReaderMenuAction } from '../screens/reader/ReaderMenu';
import { ReaderPage } from '../screens/reader/ReaderPage';
import {
  readingBackdrop,
  ReadingThemeSheet,
  THEMES,
  type ReadingTheme,
} from '../screens/reader/ReadingThemeSheet';
import { usePageRenders } from '../screens/reader/usePageRenders';
import { usePageThumbs } from '../screens/reader/usePageThumbs';
import { useReaderChrome } from '../screens/reader/useReaderChrome';
import { ToolPickPrompt } from '../screens/tools/ToolPickPrompt';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { BandIconButton } from '../ui/BandIconButton';
import { Icon } from '../ui/Icon';
import { PillButton } from '../ui/PillButton';
import { ReaderBar } from '../ui/ReaderBar';
import { uiRadius } from '../ui/tokens';
import { UiText } from '../ui/UiText';
import { commonErrors, useErrorDialog } from '../ui/useErrorDialog';

/** Reader bar height without the top inset, in dp (matches `ReaderBar`). */
const BAR_HEIGHT = 72;
/** Gap between pages, in dp. */
const PAGE_GAP = 6;
/** Edit button size and its margin from the screen edges, in dp. */
const FAB_SIZE = 56;
const FAB_MARGIN = 16;
const VIEWABILITY = { itemVisiblePercentThreshold: 40 };
/** Menu rows the Reader supports now; Find (Task 13) and Open with (Task 14) join later. */
const MENU_ACTIONS: readonly ReaderMenuAction[] = ['goto', 'translate', 'theme', 'print', 'info'];

type Panel = 'menu' | 'grid' | 'theme' | 'info';
type OpenDocument = { file: RecentFile; pageCount: number };

type Props = {
  initialFile?: RecentFile;
  onClose: () => void;
  onOpenEditor: (file: RecentFile) => void;
  onOpenTranslate: (file: RecentFile) => void;
};

/**
 * Reader: pages edge to edge under a dark bar (Share, More), a page pill while scrolling, a fast
 * scroller, an Edit button, and the menu, page grid, reading theme and file info panels.
 */
export function ViewPdfTool({ initialFile, onClose, onOpenEditor, onOpenTranslate }: Props) {
  const tx = useTx();
  const ui = useUi();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { errorDialog, showError } = useErrorDialog();
  const addFile = useRecentFilesStore((state) => state.addFile);

  const [doc, setDoc] = useState<OpenDocument | null>(null);
  const [loading, setLoading] = useState(initialFile !== undefined);
  const [currentPage, setCurrentPage] = useState(0);
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('light');
  const [panel, setPanel] = useState<Panel | null>(null);
  const listRef = useRef<FlatList<number>>(null);

  const fileUri = doc?.file.uri ?? null;
  const pageCount = doc?.pageCount ?? 0;
  const renders = usePageRenders(fileUri, pageCount, currentPage);
  const { thumbs, requestThumbs } = usePageThumbs(fileUri);
  const chrome = useReaderChrome();

  const topPad = BAR_HEIGHT + insets.top;

  /** Loads the page count and shows `file`; returns the page count, or null when it can't open. */
  const loadDocument = async (file: RecentFile): Promise<number | null> => {
    try {
      const total = await getPageCount(file.uri);
      setDoc({ file: { ...file, pageCount: total }, pageCount: total });
      setCurrentPage(0);
      return total;
    } catch (error) {
      showOpenError(error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/x-pdf'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      setLoading(true);
      const total = await loadDocument({
        id: asset.uri,
        name: asset.name,
        uri: asset.uri,
        sizeBytes: asset.size ?? 0,
        date: '',
        pageCount: 0,
        category: 'all',
      });
      if (total === null) return;
      await addFile({
        name: asset.name,
        hindiName: asset.name.replace(/\.pdf$/i, '') + '_हिंदी.pdf',
        uri: asset.uri,
        pageCount: total,
        sizeBytes: asset.size ?? 0,
        category: 'all',
        folder: 'Viewed',
      });
    } catch (error) {
      console.warn('Pick document error', error);
    }
  };

  const showOpenError = (error: unknown) => {
    console.warn('Reader open failed', error);
    showError({ ...commonErrors(tx).open, onRetry: () => void pickFile() });
  };
  const reportOpenError = useEffectEvent(showOpenError);

  // `loading` starts true when a file was passed in; this loads it once.
  useEffect(() => {
    if (!initialFile) return;
    let active = true;
    getPageCount(initialFile.uri)
      .then((total) => {
        if (active) setDoc({ file: { ...initialFile, pageCount: total }, pageCount: total });
      })
      .catch((error: unknown) => {
        if (active) reportOpenError(error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialFile]);

  // Pages not rendered yet borrow the first rendered page's shape, so most files lay out once
  // and scrolling to a far page lands where expected.
  const layout = useMemo(
    () => readerPageLayout(pageCount, renders, width, topPad, PAGE_GAP),
    [renders, pageCount, width, topPad],
  );

  const wash = THEMES[readingTheme].pageWash;
  const listExtra = useMemo(() => ({ renders, wash }), [renders, wash]);
  const pages = useMemo(() => Array.from({ length: pageCount }, (_, i) => i), [pageCount]);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<number>[] }) => {
      const first = viewableItems[0];
      if (first && first.index !== null) setCurrentPage(first.index);
    },
    [],
  );

  /** Scrolls so page `page` (zero-based) starts just under the bar. */
  const scrollToPage = (page: number) => {
    chrome.ignoreNextScroll();
    listRef.current?.scrollToIndex({ index: page, animated: false, viewOffset: topPad });
    setCurrentPage(page);
  };

  const handleScrubTo = (page: number) => {
    requestThumbs([page]);
    scrollToPage(page);
  };

  const handleShare = async () => {
    if (!doc) return;
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is unavailable');
      await Sharing.shareAsync(doc.file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: doc.file.name,
      });
    } catch (error) {
      console.warn('Share failed', error);
      showError({ ...commonErrors(tx).share, onRetry: () => void handleShare() });
    }
  };

  const handlePrint = async () => {
    if (!doc) return;
    try {
      await Print.printAsync({ uri: doc.file.uri });
    } catch (error) {
      console.warn('Print failed', error);
      showError({
        title: tx("Couldn't print the PDF", 'PDF प्रिंट नहीं हो सकी'),
        body: tx(
          "The print screen didn't open. Try again, or share the PDF to a print app.",
          'प्रिंट स्क्रीन नहीं खुली। फिर से करें, या PDF को किसी प्रिंट ऐप में शेयर करें।',
        ),
        onRetry: () => void handlePrint(),
      });
    }
  };

  const handleMenuAction = (action: ReaderMenuAction) => {
    if (!doc) return;
    switch (action) {
      case 'goto':
        setPanel('grid');
        break;
      case 'translate':
        onOpenTranslate(doc.file);
        break;
      case 'theme':
        setPanel('theme');
        break;
      case 'print':
        void handlePrint();
        break;
      case 'info':
        setPanel('info');
        break;
    }
  };

  const closePanel = () => setPanel(null);
  const thumbUriFor = (page: number) => renders[page]?.uri ?? thumbs[page];
  const backdrop = readingBackdrop(readingTheme, ui);
  const title = doc?.file.name ?? tx('Read', 'पढ़ें');

  if (!doc) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <ReaderBar title={title} leadingIcon="arrow-back" onLeading={onClose} />
        {loading ? (
          <ActivityIndicator style={{ marginTop: 64 }} size="large" color={ui.brandOnSurface} />
        ) : (
          <View style={{ gap: 24 }}>
            <ToolPickPrompt
              icon="menu-book"
              iconColor={ui.category.read}
              title={tx('Choose a PDF to read', 'पढ़ने के लिए PDF चुनें')}
              body={tx(
                'Hindi and English PDFs open here. The file is not changed.',
                'हिंदी और अंग्रेज़ी PDF यहाँ खुलती हैं। फ़ाइल नहीं बदलती।',
              )}
            />
            <View style={{ alignSelf: 'center' }}>
              <PillButton title={tx('Choose a PDF', 'PDF चुनें')} onPress={() => void pickFile()} />
            </View>
          </View>
        )}
        {errorDialog}
      </View>
    );
  }

  const hiddenA11y = chrome.visible ? 'auto' : 'no-hide-descendants';

  return (
    <View style={{ flex: 1, backgroundColor: backdrop }}>
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(page) => `page-${page}`}
        extraData={listExtra}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        onScroll={chrome.onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        getItemLayout={(_data, index) => ({
          length: layout.heights[index] + PAGE_GAP,
          offset: layout.offsets[index],
          index,
        })}
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: insets.bottom + FAB_SIZE + FAB_MARGIN * 2,
        }}
        renderItem={({ item: page }) => {
          const render = renders[page];
          return (
            <View style={{ marginBottom: PAGE_GAP }}>
              <ReaderPage
                page={page}
                pageCount={pageCount}
                width={width}
                height={layout.heights[page]}
                uri={render?.uri}
                failed={render !== undefined && !render.uri}
                wash={wash}
                onPress={chrome.toggle}
              />
            </View>
          );
        }}
      />

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          right: 0,
          top: topPad + 56,
          bottom: insets.bottom + FAB_SIZE + FAB_MARGIN * 2,
        }}
      >
        <PageScroller
          pageCount={pageCount}
          currentPage={currentPage}
          onScrubTo={handleScrubTo}
          previewUriFor={thumbUriFor}
        />
      </View>

      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          top: topPad + 8,
          right: 24,
          opacity: chrome.pillOpacity,
          transform: [
            {
              translateY: chrome.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-BAR_HEIGHT, 0],
              }),
            },
          ],
          backgroundColor: 'rgba(20, 22, 31, 0.86)',
          borderRadius: 9999,
          paddingHorizontal: 12,
          paddingVertical: 6,
        }}
      >
        <UiText color="#FFFFFF" style={{ fontSize: 14, fontWeight: '500' }}>
          {`${currentPage + 1} / ${pageCount}`}
        </UiText>
      </Animated.View>

      <Animated.View
        pointerEvents={chrome.visible ? 'box-none' : 'none'}
        importantForAccessibility={hiddenA11y}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          transform: [
            {
              translateY: chrome.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-topPad, 0],
              }),
            },
          ],
        }}
      >
        <ReaderBar
          title={title}
          leadingIcon="arrow-back"
          onLeading={onClose}
          actions={
            <>
              <BandIconButton
                icon="share"
                label={tx('Share', 'शेयर करें')}
                onPress={() => void handleShare()}
              />
              <BandIconButton
                icon="more-vert"
                label={tx('More options', 'और विकल्प')}
                onPress={() => setPanel('menu')}
              />
            </>
          }
        />
      </Animated.View>

      <Animated.View
        pointerEvents={chrome.visible ? 'box-none' : 'none'}
        importantForAccessibility={hiddenA11y}
        style={{
          position: 'absolute',
          right: FAB_MARGIN,
          bottom: FAB_MARGIN + insets.bottom,
          transform: [
            {
              translateY: chrome.progress.interpolate({
                inputRange: [0, 1],
                outputRange: [FAB_SIZE + FAB_MARGIN + insets.bottom, 0],
              }),
            },
          ],
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('Edit', 'संपादित करें')}
          onPress={() => onOpenEditor(doc.file)}
          android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: false }}
          style={{
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: uiRadius.fab,
            backgroundColor: ui.brand,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            elevation: 6,
          }}
        >
          <Icon name="edit" size={24} color="#FFFFFF" />
        </Pressable>
      </Animated.View>

      <ReaderMenu
        visible={panel === 'menu'}
        onClose={closePanel}
        onAction={handleMenuAction}
        actions={MENU_ACTIONS}
      />
      <PageGrid
        visible={panel === 'grid'}
        pageCount={pageCount}
        currentPage={currentPage}
        thumbUriFor={thumbUriFor}
        onVisiblePages={requestThumbs}
        onPick={(page) => {
          closePanel();
          chrome.show();
          scrollToPage(page);
        }}
        onClose={closePanel}
      />
      <ReadingThemeSheet
        visible={panel === 'theme'}
        value={readingTheme}
        onChange={setReadingTheme}
        onClose={closePanel}
      />
      <FileInfoSheet
        visible={panel === 'info'}
        onClose={closePanel}
        file={doc.file}
        pageCount={pageCount}
      />
      {errorDialog}
    </View>
  );
}
