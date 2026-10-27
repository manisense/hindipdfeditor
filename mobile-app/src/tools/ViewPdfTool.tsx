import { useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OcrHighlightLayer } from '../components/OcrHighlightLayer';
import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { openWith } from '../lib/openWith';
import { getPageCount } from '../lib/pdfToImages';
import { A4_ASPECT } from '../lib/readerLayout';
import { fitPage } from '../lib/zoomMath';
import { findMatches, indexOfMatch, matchKeyAt, stepMatch, type MatchKey } from '../lib/textSearch';
import { useHardwareBack } from '../navigation/useHardwareBack';
import { FileInfoSheet } from '../screens/reader/FileInfoSheet';
import { FindBar, FindPanel } from '../screens/reader/FindInFile';
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
import { usePageText } from '../screens/reader/usePageText';
import { usePageThumbs } from '../screens/reader/usePageThumbs';
import { useReaderChrome } from '../screens/reader/useReaderChrome';
import { useSettledValue } from '../screens/reader/useSettledValue';
import { ZoomablePage } from '../screens/reader/ZoomablePage';
import { ToolPickPrompt } from '../screens/tools/ToolPickPrompt';
import type { OcrLine } from '../state/editStore';
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
/** Space around a fitted page, in dp. */
const PAGE_MARGIN = 8;
/** Edit button size and its margin from the screen edges, in dp. */
const FAB_SIZE = 56;
const FAB_MARGIN = 16;
/** How long the page must stay put before full-size renders start, in ms (skips scrub steps). */
const SETTLE_MS = 150;
/** Menu rows the Reader supports, in menu order. */
const MENU_ACTIONS: readonly ReaderMenuAction[] = [
  'find',
  'goto',
  'translate',
  'theme',
  'print',
  'openWith',
  'info',
];

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
  const { width, height } = useWindowDimensions();
  const { errorDialog, showError } = useErrorDialog();
  const addFile = useRecentFilesStore((state) => state.addFile);

  const [doc, setDoc] = useState<OpenDocument | null>(null);
  const [loading, setLoading] = useState(initialFile !== undefined);
  const [currentPage, setCurrentPage] = useState(0);
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('light');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  /** Selected match, kept as a key so it stays put while results for other pages arrive. */
  const [selectedKey, setSelectedKey] = useState<MatchKey | null>(null);
  const listRef = useRef<FlatList<number>>(null);
  /** True while the current page is zoomed in; the list then stops turning pages. */
  const [zoomed, setZoomed] = useState(false);

  const fileUri = doc?.file.uri ?? null;
  const pageCount = doc?.pageCount ?? 0;
  const settledPage = useSettledValue(currentPage, SETTLE_MS);
  const { renders, sizes } = usePageRenders(fileUri, pageCount, settledPage);
  const { thumbs, requestThumbs } = usePageThumbs(fileUri);
  const chrome = useReaderChrome();
  const pageText = usePageText(fileUri, pageCount, searching, currentPage);
  const deferredQuery = useDeferredValue(query);
  const matches = useMemo(
    () =>
      findMatches(
        pageText.pages.map((p) => ({ pageIndex: p.pageIndex, lines: p.lines.map((l) => l.text) })),
        deferredQuery,
      ),
    [pageText.pages, deferredQuery],
  );
  const currentMatch = indexOfMatch(matches, selectedKey);

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

  // Each page fits the screen like a book page. Pages not rendered yet borrow the first rendered
  // page's shape, so most files lay out once.
  const fallbackAspect = useMemo(() => {
    const known = Object.values(sizes).find((s) => s.width && s.height);
    return known?.width && known.height ? known.width / known.height : A4_ASPECT;
  }, [sizes]);
  const pageArea = {
    width: width - PAGE_MARGIN * 2,
    // Below the bar, so the top of the page is never hidden under it.
    height: height - topPad - insets.bottom - PAGE_MARGIN * 2,
  };
  const fittedSize = (page: number) => {
    const size = sizes[page];
    const aspect = size?.width && size.height ? size.width / size.height : fallbackAspect;
    return fitPage(pageArea.width, pageArea.height, aspect);
  };

  const wash = THEMES[readingTheme].pageWash;
  // Matched lines per page; the current match is drawn stronger.
  const highlights = useMemo(() => {
    const byPage: Record<number, { lines: OcrLine[]; widthPt: number; currentId?: string }> = {};
    if (!searching) return byPage;
    matches.forEach((m, index) => {
      const text = pageText.pages.find((p) => p.pageIndex === m.pageIndex);
      const line = text?.lines[m.lineIndex];
      if (!text || !line) return;
      const entry = (byPage[m.pageIndex] ??= { lines: [], widthPt: text.widthPt });
      if (!entry.lines.includes(line)) entry.lines.push(line);
      if (index === currentMatch) entry.currentId = line.id;
    });
    return byPage;
  }, [searching, matches, pageText.pages, currentMatch]);
  const listExtra = useMemo(() => ({ renders, wash, highlights }), [renders, wash, highlights]);
  const pages = useMemo(() => Array.from({ length: pageCount }, (_, i) => i), [pageCount]);

  // One page per screen width; the current page is the one most on screen.
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // The find bar stays put while searching.
    if (!searching) chrome.onScroll(event);
    const page = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentPage(Math.min(Math.max(page, 0), Math.max(pageCount - 1, 0)));
  };

  /** Turns to page `page` (zero-based). */
  const scrollToPage = (page: number) => {
    chrome.ignoreNextScroll();
    listRef.current?.scrollToIndex({ index: page, animated: false });
    setCurrentPage(page);
  };

  const openSearch = () => {
    chrome.show();
    setSearching(true);
  };

  const closeSearch = () => {
    setSearching(false);
    setQuery('');
    setSelectedKey(null);
  };

  useHardwareBack(() => {
    closeSearch();
    return true;
  }, searching);

  /** Selects the match `key` names and turns to its page. */
  const selectMatch = (key: MatchKey | null) => {
    const m = matches[indexOfMatch(matches, key)];
    if (!key || !m) return;
    setSelectedKey(key);
    Keyboard.dismiss();
    scrollToPage(m.pageIndex);
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

  const handleOpenWith = async () => {
    if (!doc) return;
    try {
      await openWith(doc.file.uri);
    } catch (error) {
      console.warn('Open with failed', error);
      showError({
        title: tx('No app can open this PDF', 'इस PDF को खोलने वाला कोई ऐप नहीं मिला'),
        body: tx(
          'Install a PDF app such as Google Drive or Files, or share the PDF instead.',
          'Google Drive या Files जैसा कोई PDF ऐप इंस्टॉल करें, या PDF को शेयर करें।',
        ),
      });
    }
  };

  const handleMenuAction = (action: ReaderMenuAction) => {
    if (!doc) return;
    switch (action) {
      case 'find':
        openSearch();
        break;
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
      case 'openWith':
        void handleOpenWith();
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
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        keyExtractor={(page) => `page-${page}`}
        extraData={listExtra}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        getItemLayout={(_data, index) => ({ length: width, offset: width * index, index })}
        renderItem={({ item: page }) => {
          const render = renders[page];
          const found = highlights[page];
          const size = fittedSize(page);
          return (
            <View
              style={{
                width,
                height,
                paddingTop: topPad,
                paddingBottom: insets.bottom,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ZoomablePage
                width={size.width}
                height={size.height}
                active={page === currentPage}
                onTap={searching ? Keyboard.dismiss : chrome.toggle}
                onZoomedChange={setZoomed}
              >
                <ReaderPage
                  page={page}
                  pageCount={pageCount}
                  width={size.width}
                  height={size.height}
                  uri={render?.uri}
                  failed={render !== undefined && !render.uri}
                  wash={wash}
                  onPress={searching ? Keyboard.dismiss : chrome.toggle}
                />
                {found && found.widthPt > 0 ? (
                  <OcrHighlightLayer
                    visible
                    tone="search"
                    lines={found.lines}
                    currentId={found.currentId}
                    viewWidthDp={size.width}
                    pageWidthPt={found.widthPt}
                  />
                ) : null}
              </ZoomablePage>
            </View>
          );
        }}
      />

      <View
        pointerEvents={searching ? 'none' : 'box-none'}
        importantForAccessibility={searching ? 'no-hide-descendants' : 'auto'}
        style={{
          opacity: searching ? 0 : 1,
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
        {searching ? (
          <FindBar
            query={query}
            onChangeQuery={(next) => {
              setQuery(next);
              setSelectedKey(null);
            }}
            onClose={closeSearch}
          />
        ) : (
          <ReaderBar
            title={title}
            leadingIcon="arrow-back"
            onLeading={onClose}
            actions={
              <>
                <BandIconButton
                  icon="search"
                  label={tx('Find in file', 'फ़ाइल में खोजें')}
                  onPress={openSearch}
                />
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
        )}
      </Animated.View>

      <Animated.View
        pointerEvents={chrome.visible && !searching ? 'box-none' : 'none'}
        importantForAccessibility={searching ? 'no-hide-descendants' : hiddenA11y}
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

      {searching ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <FindPanel
            query={deferredQuery}
            matches={matches}
            currentIndex={currentMatch}
            done={pageText.done}
            pageCount={pageCount}
            failedPages={pageText.pages.filter((p) => p.failed).length}
            onPick={(index) => selectMatch(matchKeyAt(matches, index))}
            onStep={(delta) => selectMatch(stepMatch(matches, selectedKey, delta))}
          />
        </View>
      ) : null}

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
