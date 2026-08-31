import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { AppButton } from '../components/AppButton';
import { useAppPopup } from '../components/appPopupContext';
import { DropZone } from '../components/DropZone';
import { getPageCount, renderPage } from '../lib/pdfToImages';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { colors, radius, shadows, spacing } from '../theme';

type ViewMode = 'continuous' | 'single';
type ReadingTheme = 'light' | 'sepia' | 'dark';

type PageRenderItem = {
  pageIndex: number;
  uri?: string;
  width?: number;
  height?: number;
  loading: boolean;
};

type Props = {
  initialFileUri?: string;
  initialFileName?: string;
  onOpenEditor?: (file: RecentFile) => void;
  onOpenTranslate?: (file: RecentFile) => void;
};

const THEMES: Record<
  ReadingTheme,
  {
    name: string;
    hindi: string;
    iconName: keyof typeof Ionicons.glyphMap;
    bg: string;
    cardBg: string;
    textColor: string;
    subTextColor: string;
    border: string;
    pageFilter?: string;
  }
> = {
  light: {
    name: 'Day Light',
    hindi: 'दिन / सामान्य',
    iconName: 'sunny-outline',
    bg: '#F1F5F9',
    cardBg: '#FFFFFF',
    textColor: '#0F172A',
    subTextColor: '#64748B',
    border: '#E2E8F0',
  },
  sepia: {
    name: 'Warm Sepia',
    hindi: 'सेपिया / सुगम',
    iconName: 'book-outline',
    bg: '#F5EFE6',
    cardBg: '#FAF5EE',
    textColor: '#3D312A',
    subTextColor: '#7D6A5D',
    border: '#E8DCCF',
  },
  dark: {
    name: 'Night Dark',
    hindi: 'रात / डार्क',
    iconName: 'moon-outline',
    bg: '#0F172A',
    cardBg: '#1E293B',
    textColor: '#F8FAFC',
    subTextColor: '#94A3B8',
    border: '#334155',
  },
};

export function ViewPdfTool({
  initialFileUri,
  initialFileName,
  onOpenEditor,
  onOpenTranslate,
}: Props) {
  const { showPopup } = useAppPopup();
  const addFile = useRecentFilesStore((state) => state.addFile);

  const [fileUri, setFileUri] = useState<string | null>(initialFileUri ?? null);
  const [fileName, setFileName] = useState<string>(initialFileName ?? 'Document.pdf');
  const [pageCount, setPageCount] = useState<number>(0);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const [currentPage, setCurrentPage] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('continuous');
  const [theme, setTheme] = useState<ReadingTheme>('light');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const [showJumpModal, setShowJumpModal] = useState<boolean>(false);
  const [jumpPageInput, setJumpPageInput] = useState<string>('1');
  const [showDocInfoModal, setShowDocInfoModal] = useState<boolean>(false);

  // Cached page images
  const [pageRenders, setPageRenders] = useState<Record<number, PageRenderItem>>({});
  const renderingRef = useRef<Set<number>>(new Set());
  const flatListRef = useRef<FlatList<number> | null>(null);

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentPage(viewableItems[0].index);
      }
    },
    [],
  );

  const screenWidth = Dimensions.get('window').width;

  const loadDocument = useCallback(
    async (uri: string, name?: string) => {
      setLoadingDoc(true);
      try {
        const total = await getPageCount(uri);
        const docName = name ?? uri.split('/').pop() ?? 'Document.pdf';
        setFileUri(uri);
        setFileName(docName);
        setPageCount(total);
        setCurrentPage(0);
        setPageRenders({});
        renderingRef.current.clear();

        // Add to recent files store
        await addFile({
          name: docName,
          hindiName: docName.replace(/\.pdf$/i, '') + '_हिंदी.pdf',
          uri,
          pageCount: total,
          sizeBytes: 0,
          category: 'all',
          folder: 'Viewed',
        });
      } catch {
        showPopup({
          title: 'Error Opening PDF',
          message:
            'Could not load the selected PDF document. It may be password-protected or corrupted.',
          tone: 'error',
        });
      } finally {
        setLoadingDoc(false);
      }
    },
    [addFile, showPopup],
  );

  useEffect(() => {
    if (!initialFileUri) return;
    let isMounted = true;

    async function loadInitial() {
      try {
        const total = await getPageCount(initialFileUri!);
        const docName = initialFileName ?? initialFileUri!.split('/').pop() ?? 'Document.pdf';
        if (isMounted) {
          setFileUri(initialFileUri!);
          setFileName(docName);
          setPageCount(total);
          setCurrentPage(0);
          setPageRenders({});
          renderingRef.current.clear();
        }
      } catch (err) {
        console.warn('Failed to load initial file in ViewPdfTool', err);
      }
    }

    void loadInitial();

    return () => {
      isMounted = false;
    };
  }, [initialFileUri, initialFileName]);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/x-pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        void loadDocument(asset.uri, asset.name);
      }
    } catch (err) {
      console.warn('Pick document error', err);
    }
  };

  // Pre-load and render pages with caching
  useEffect(() => {
    if (!fileUri || pageCount === 0) return;
    let isMounted = true;

    async function renderPageBatch() {
      const indicesToRender = [currentPage];
      if (currentPage + 1 < pageCount) indicesToRender.push(currentPage + 1);
      if (currentPage - 1 >= 0) indicesToRender.push(currentPage - 1);

      for (const idx of indicesToRender) {
        if (renderingRef.current.has(idx) || pageRenders[idx]?.uri) continue;
        renderingRef.current.add(idx);

        try {
          const rendered = await renderPage(fileUri!, idx, 2.5);
          if (isMounted) {
            setPageRenders((prev) => ({
              ...prev,
              [idx]: {
                pageIndex: idx,
                uri: rendered.uri,
                width: rendered.pxWidth,
                height: rendered.pxHeight,
                loading: false,
              },
            }));
          }
        } catch (err) {
          console.warn(`Failed to render page ${idx}`, err);
          if (isMounted) {
            setPageRenders((prev) => ({
              ...prev,
              [idx]: { pageIndex: idx, loading: false },
            }));
          }
        }
      }
    }

    void renderPageBatch();

    return () => {
      isMounted = false;
    };
  }, [fileUri, pageCount, currentPage, pageRenders]);

  const handleJumpToPage = () => {
    const p = parseInt(jumpPageInput.trim(), 10);
    if (isNaN(p) || p < 1 || p > pageCount) {
      showPopup({
        title: 'Invalid Page Number',
        message: `Please enter a valid page number between 1 and ${pageCount}.`,
        tone: 'warning',
      });
      return;
    }
    const targetIndex = p - 1;
    setCurrentPage(targetIndex);
    setShowJumpModal(false);
    if (flatListRef.current) {
      flatListRef.current.scrollToIndex({ index: targetIndex, animated: true });
    }
  };

  const handleShare = async () => {
    if (!fileUri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${fileName}`,
        });
      }
    } catch {
      // ignore
    }
  };

  const handlePrint = async () => {
    if (!fileUri) return;
    try {
      await Print.printAsync({ uri: fileUri });
    } catch {
      // ignore
    }
  };

  const currentTheme = THEMES[theme];
  const pageIndexes = Array.from({ length: pageCount }, (_, i) => i);

  if (!fileUri) {
    return (
      <View style={styles.container}>
        <DropZone
          onSelect={handlePickFile}
          title="Open PDF in Reader / व्यूअर में खोलें"
          subtitle="Select any Hindi or English PDF file from your phone storage to read and view."
          buttonLabel="Select PDF to Read"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.bg }]}>
      {/* Top Header & Reading Controls (Hidden in Fullscreen Mode) */}
      {!isFullscreen && (
        <View
          style={[
            styles.readerHeader,
            { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.border },
          ]}
        >
          <View style={styles.headerTitleRow}>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>📖</Text>
            </View>
            <View style={styles.headerInfoGroup}>
              <Text
                style={[styles.headerDocTitle, { color: currentTheme.textColor }]}
                numberOfLines={1}
              >
                {fileName}
              </Text>
              <Text style={[styles.headerDocSub, { color: currentTheme.subTextColor }]}>
                {pageCount} Pages • Page {currentPage + 1} of {pageCount}
              </Text>
            </View>

            {/* Quick Document Info Modal Trigger */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Document properties"
              onPress={() => setShowDocInfoModal(true)}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={currentTheme.textColor}
              />
            </Pressable>

            {/* Change File Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open different PDF"
              onPress={handlePickFile}
              style={({ pressed }) => [styles.headerIconBtn, pressed && styles.btnPressed]}
              hitSlop={8}
            >
              <Ionicons name="folder-open-outline" size={18} color={currentTheme.textColor} />
            </Pressable>
          </View>

          {/* Viewer Control Bar */}
          <View style={[styles.controlBar, { borderTopColor: currentTheme.border }]}>
            {/* View Mode Toggle: Continuous vs Single Page */}
            <View style={[styles.modeToggleGroup, { backgroundColor: currentTheme.bg }]}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: viewMode === 'continuous' }}
                onPress={() => setViewMode('continuous')}
                style={[
                  styles.modeTab,
                  viewMode === 'continuous' && {
                    backgroundColor: colors.brand,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons
                    name="infinite-outline"
                    size={13}
                    color={viewMode === 'continuous' ? '#ffffff' : currentTheme.subTextColor}
                  />
                  <Text
                    style={[
                      styles.modeTabText,
                      {
                        color: viewMode === 'continuous' ? '#ffffff' : currentTheme.subTextColor,
                      },
                    ]}
                  >
                    Scroll
                  </Text>
                </View>
              </Pressable>

              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: viewMode === 'single' }}
                onPress={() => setViewMode('single')}
                style={[
                  styles.modeTab,
                  viewMode === 'single' && {
                    backgroundColor: colors.brand,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons
                    name="document-outline"
                    size={13}
                    color={viewMode === 'single' ? '#ffffff' : currentTheme.subTextColor}
                  />
                  <Text
                    style={[
                      styles.modeTabText,
                      {
                        color: viewMode === 'single' ? '#ffffff' : currentTheme.subTextColor,
                      },
                    ]}
                  >
                    Single
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Theme Selector */}
            <View style={styles.themeSelectorGroup}>
              {(['light', 'sepia', 'dark'] as ReadingTheme[]).map((t) => (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch to ${THEMES[t].name} reading theme`}
                  onPress={() => setTheme(t)}
                  style={[
                    styles.themeBtn,
                    { backgroundColor: THEMES[t].cardBg, borderColor: THEMES[t].border },
                    theme === t && styles.themeBtnActive,
                  ]}
                >
                  <Ionicons
                    name={THEMES[t].iconName}
                    size={16}
                    color={theme === t ? colors.brand : THEMES[t].textColor}
                  />
                </Pressable>
              ))}
            </View>

            {/* Zoom Controls */}
            <View style={[styles.zoomGroup, { backgroundColor: currentTheme.bg }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
                onPress={() => setZoomScale((z) => Math.max(0.75, Number((z - 0.25).toFixed(2))))}
                style={styles.zoomBtn}
                hitSlop={6}
              >
                <Text style={[styles.zoomBtnText, { color: currentTheme.textColor }]}>−</Text>
              </Pressable>
              <Text style={[styles.zoomLevelText, { color: currentTheme.textColor }]}>
                {Math.round(zoomScale * 100)}%
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
                onPress={() => setZoomScale((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                style={styles.zoomBtn}
                hitSlop={6}
              >
                <Text style={[styles.zoomBtnText, { color: currentTheme.textColor }]}>+</Text>
              </Pressable>
            </View>

            {/* Fullscreen Toggle */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enter fullscreen reading mode"
              onPress={() => setIsFullscreen(true)}
              style={[styles.actionBtn, { backgroundColor: currentTheme.bg }]}
              hitSlop={6}
            >
              <Text style={[styles.actionBtnIcon, { color: currentTheme.textColor }]}>⛶</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Main Reading Viewport */}
      {loadingDoc ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={[styles.loadingText, { color: currentTheme.textColor }]}>
            Loading PDF document...
          </Text>
        </View>
      ) : viewMode === 'continuous' ? (
        /* Continuous Vertical Scroll Mode */
        <FlatList
          ref={flatListRef}
          data={pageIndexes}
          keyExtractor={(item) => `page-${item}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: isFullscreen ? 80 : 120 }]}
          onViewableItemsChanged={handleViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
          renderItem={({ item: index }) => {
            const pageData = pageRenders[index];
            const basePageWidth = screenWidth - 32;
            const scaledWidth = basePageWidth * zoomScale;
            const aspectRatio =
              pageData?.width && pageData?.height ? pageData.width / pageData.height : 1 / 1.414; // default A4 ratio
            const scaledHeight = scaledWidth / aspectRatio;

            return (
              <View
                style={[
                  styles.pageContainer,
                  {
                    width: scaledWidth,
                    minHeight: scaledHeight,
                    backgroundColor: currentTheme.cardBg,
                    borderColor: currentTheme.border,
                    alignSelf: 'center',
                  },
                ]}
              >
                {/* Page Number Header */}
                <View style={[styles.pageHeaderBadge, { borderBottomColor: currentTheme.border }]}>
                  <Text style={[styles.pageBadgeText, { color: currentTheme.subTextColor }]}>
                    Page {index + 1} of {pageCount}
                  </Text>
                </View>

                {pageData?.uri ? (
                  <Image
                    source={{ uri: pageData.uri }}
                    style={[
                      styles.pageImage,
                      {
                        width: scaledWidth,
                        height: scaledHeight,
                        opacity: theme === 'dark' ? 0.92 : 1,
                      },
                    ]}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.pagePlaceholder, { height: scaledHeight }]}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={[styles.placeholderText, { color: currentTheme.subTextColor }]}>
                      Rendering page {index + 1}...
                    </Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      ) : (
        /* Single Page Flip Mode */
        <ScrollView
          contentContainerStyle={[
            styles.singlePageScroll,
            { paddingBottom: isFullscreen ? 80 : 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {(() => {
            const pageData = pageRenders[currentPage];
            const basePageWidth = screenWidth - 32;
            const scaledWidth = basePageWidth * zoomScale;
            const aspectRatio =
              pageData?.width && pageData?.height ? pageData.width / pageData.height : 1 / 1.414;
            const scaledHeight = scaledWidth / aspectRatio;

            return (
              <View
                style={[
                  styles.pageContainer,
                  {
                    width: scaledWidth,
                    minHeight: scaledHeight,
                    backgroundColor: currentTheme.cardBg,
                    borderColor: currentTheme.border,
                    alignSelf: 'center',
                  },
                ]}
              >
                <View style={[styles.pageHeaderBadge, { borderBottomColor: currentTheme.border }]}>
                  <Text style={[styles.pageBadgeText, { color: currentTheme.subTextColor }]}>
                    Page {currentPage + 1} of {pageCount}
                  </Text>
                </View>

                {pageData?.uri ? (
                  <Image
                    source={{ uri: pageData.uri }}
                    style={[
                      styles.pageImage,
                      {
                        width: scaledWidth,
                        height: scaledHeight,
                        opacity: theme === 'dark' ? 0.92 : 1,
                      },
                    ]}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={[styles.pagePlaceholder, { height: scaledHeight }]}>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={[styles.placeholderText, { color: currentTheme.subTextColor }]}>
                      Rendering page {currentPage + 1}...
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}
        </ScrollView>
      )}

      {/* Floating Bottom Navigation & Action Island */}
      <View style={styles.floatingBottomContainer} pointerEvents="box-none">
        {/* Page Scrubber Pill */}
        <View
          style={[
            styles.floatingPagePill,
            { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.border },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous page"
            disabled={currentPage === 0}
            onPress={() => {
              const prev = Math.max(0, currentPage - 1);
              setCurrentPage(prev);
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({ index: prev, animated: true });
              }
            }}
            style={[styles.pillNavBtn, currentPage === 0 && styles.btnDisabled]}
            hitSlop={8}
          >
            <Text
              style={[
                styles.pillNavText,
                { color: currentPage === 0 ? colors.textTertiary : colors.brand },
              ]}
            >
              ‹ Prev
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Jump to page"
            onPress={() => {
              setJumpPageInput(String(currentPage + 1));
              setShowJumpModal(true);
            }}
            style={styles.pillPageBadge}
          >
            <Text style={[styles.pillPageText, { color: currentTheme.textColor }]}>
              {currentPage + 1} / {pageCount}
            </Text>
            <Text style={[styles.pillJumpHint, { color: currentTheme.subTextColor }]}>
              Tap to jump
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next page"
            disabled={currentPage >= pageCount - 1}
            onPress={() => {
              const next = Math.min(pageCount - 1, currentPage + 1);
              setCurrentPage(next);
              if (flatListRef.current) {
                flatListRef.current.scrollToIndex({ index: next, animated: true });
              }
            }}
            style={[styles.pillNavBtn, currentPage >= pageCount - 1 && styles.btnDisabled]}
            hitSlop={8}
          >
            <Text
              style={[
                styles.pillNavText,
                {
                  color: currentPage >= pageCount - 1 ? colors.textTertiary : colors.brand,
                },
              ]}
            >
              Next ›
            </Text>
          </Pressable>
        </View>

        {/* Action Buttons Row: Edit in Editor, Translate, Share, Exit Fullscreen */}
        <View style={styles.floatingActionsRow} pointerEvents="box-none">
          {isFullscreen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Exit fullscreen mode"
              onPress={() => setIsFullscreen(false)}
              style={styles.exitFullscreenBtn}
            >
              <Text style={styles.exitFullscreenText}>✕ Exit Fullscreen</Text>
            </Pressable>
          ) : (
            <>
              {/* Direct Open in Hindi Editor */}
              {onOpenEditor && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit in Hindi PDF Editor"
                  onPress={() => {
                    if (fileUri) {
                      onOpenEditor({
                        id: `view-${Date.now()}`,
                        name: fileName,
                        uri: fileUri,
                        sizeBytes: 0,
                        date: 'Today',
                        pageCount,
                        category: 'all',
                      });
                    }
                  }}
                  style={styles.editorActionBtn}
                >
                  <Ionicons name="pencil" size={14} color="#ffffff" />
                  <Text style={styles.editorActionText}>Edit Hindi Text</Text>
                </Pressable>
              )}

              {/* Direct Open in Translator */}
              {onOpenTranslate && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Translate document"
                  onPress={() => {
                    if (fileUri) {
                      onOpenTranslate({
                        id: `view-${Date.now()}`,
                        name: fileName,
                        uri: fileUri,
                        sizeBytes: 0,
                        date: 'Today',
                        pageCount,
                        category: 'all',
                      });
                    }
                  }}
                  style={styles.translateActionBtn}
                >
                  <Ionicons name="language" size={14} color="#ffffff" />
                  <Text style={styles.translateActionText}>Translate</Text>
                </Pressable>
              )}

              {/* Share */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share PDF"
                onPress={handleShare}
                style={[
                  styles.utilityCircleBtn,
                  {
                    backgroundColor: currentTheme.cardBg,
                    borderColor: currentTheme.border,
                  },
                ]}
                hitSlop={6}
              >
                <Text style={styles.utilityCircleIcon}>📤</Text>
              </Pressable>

              {/* Print */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Print PDF"
                onPress={handlePrint}
                style={[
                  styles.utilityCircleBtn,
                  {
                    backgroundColor: currentTheme.cardBg,
                    borderColor: currentTheme.border,
                  },
                ]}
                hitSlop={6}
              >
                <Text style={styles.utilityCircleIcon}>🖨️</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* Jump to Page Modal */}
      <Modal
        visible={showJumpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowJumpModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowJumpModal(false)}>
          <Pressable
            style={[
              styles.jumpModalCard,
              { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.jumpModalTitle, { color: currentTheme.textColor }]}>
              Jump to Page / पृष्ठ पर जाएं
            </Text>
            <Text style={[styles.jumpModalSub, { color: currentTheme.subTextColor }]}>
              Enter page number between 1 and {pageCount}:
            </Text>

            <TextInput
              value={jumpPageInput}
              onChangeText={setJumpPageInput}
              keyboardType="number-pad"
              maxLength={4}
              autoFocus
              style={[
                styles.jumpInput,
                {
                  color: currentTheme.textColor,
                  backgroundColor: currentTheme.bg,
                  borderColor: currentTheme.border,
                },
              ]}
              selectTextOnFocus
            />

            <View style={styles.jumpModalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowJumpModal(false)}
                style={[styles.jumpCancelBtn, { borderColor: currentTheme.border }]}
              >
                <Text style={[styles.jumpCancelText, { color: currentTheme.subTextColor }]}>
                  Cancel
                </Text>
              </Pressable>

              <AppButton
                title="Go to Page"
                variant="primary"
                onPress={handleJumpToPage}
                style={styles.jumpConfirmBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Document Properties Info Modal */}
      <Modal
        visible={showDocInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDocInfoModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDocInfoModal(false)}>
          <Pressable
            style={[
              styles.infoModalCard,
              { backgroundColor: currentTheme.cardBg, borderColor: currentTheme.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.jumpModalTitle, { color: currentTheme.textColor }]}>
              Document Properties / दस्तावेज़ विवरण
            </Text>

            <View style={styles.infoRows}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: currentTheme.subTextColor }]}>
                  File Name:
                </Text>
                <Text style={[styles.infoValue, { color: currentTheme.textColor }]}>
                  {fileName}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: currentTheme.subTextColor }]}>
                  Total Pages:
                </Text>
                <Text style={[styles.infoValue, { color: currentTheme.textColor }]}>
                  {pageCount} Pages
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: currentTheme.subTextColor }]}>
                  Current Page:
                </Text>
                <Text style={[styles.infoValue, { color: currentTheme.textColor }]}>
                  Page {currentPage + 1}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: currentTheme.subTextColor }]}>
                  Reading Mode:
                </Text>
                <Text style={[styles.infoValue, { color: currentTheme.textColor }]}>
                  {viewMode === 'continuous' ? 'Continuous Scroll' : 'Single Page'} (
                  {currentTheme.name})
                </Text>
              </View>
            </View>

            <AppButton title="Close" variant="primary" onPress={() => setShowDocInfoModal(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  readerHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs + 2,
    gap: spacing.xs,
    ...shadows.soft,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 18,
  },
  headerInfoGroup: {
    flex: 1,
    gap: 1,
  },
  headerDocTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  headerDocSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerIconBtn: {
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  headerIconText: {
    fontSize: 18,
  },
  btnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    gap: spacing.xs,
  },
  modeToggleGroup: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 2,
    gap: 2,
  },
  modeTab: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '700',
  },
  themeSelectorGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  themeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeBtnActive: {
    borderColor: colors.brand,
    borderWidth: 2,
    transform: [{ scale: 1.08 }],
  },
  themeBtnIcon: {
    fontSize: 13,
  },
  zoomGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 4,
  },
  zoomBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  zoomBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  zoomLevelText: {
    fontSize: 10.5,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'center',
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnIcon: {
    fontSize: 15,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  singlePageScroll: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  pageContainer: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.card,
  },
  pageHeaderBadge: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  pageImage: {
    alignSelf: 'center',
  },
  pagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeholderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  floatingBottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  floatingPagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  pillNavBtn: {
    paddingHorizontal: spacing.xs,
  },
  pillNavText: {
    fontSize: 13,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  pillPageBadge: {
    alignItems: 'center',
  },
  pillPageText: {
    fontSize: 13,
    fontWeight: '900',
  },
  pillJumpHint: {
    fontSize: 9,
    fontWeight: '600',
  },
  floatingActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
  },
  editorActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.brand,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: 4,
    ...shadows.soft,
  },
  editorActionIcon: {
    fontSize: 13,
  },
  editorActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  translateActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    gap: 4,
    ...shadows.soft,
  },
  translateActionIcon: {
    fontSize: 13,
  },
  translateActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  utilityCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  utilityCircleIcon: {
    fontSize: 15,
  },
  exitFullscreenBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
  },
  exitFullscreenText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  jumpModalCard: {
    width: '90%',
    maxWidth: 340,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  jumpModalTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  jumpModalSub: {
    fontSize: 13,
  },
  jumpInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: radius.xl,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
  },
  jumpModalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  jumpCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  jumpCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  jumpConfirmBtn: {
    flex: 1,
  },
  infoModalCard: {
    width: '90%',
    maxWidth: 360,
    borderRadius: radius['2xl'],
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  infoRows: {
    gap: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12.5,
    fontWeight: '700',
    maxWidth: '65%',
    textAlign: 'right',
  },
});
