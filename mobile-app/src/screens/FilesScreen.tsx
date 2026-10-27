import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, RefreshControl, SectionList, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import type { ToolId } from '../components/ToolShell';
import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import {
  getPageCount,
  hasStoragePermission,
  renderPage,
  requestStoragePermission,
  scanDevicePdfFiles,
} from '../lib/pdfToImages';
import { fileTimeMs, secondsToMs } from '../lib/fileTimes';
import { groupByRecency, type RecencyKey } from '../lib/recencyGroups';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { BandIconButton } from '../ui/BandIconButton';
import { BottomSheet } from '../ui/BottomSheet';
import { BrandBand, useBandCollapse } from '../ui/BrandBand';
import { Icon } from '../ui/Icon';
import { ListRow } from '../ui/ListRow';
import { PillButton } from '../ui/PillButton';
import { UiText } from '../ui/UiText';
import { FileRow } from './files/FileRow';
import { BandSearchField, SourceTabs, type SourceTab } from './files/FilesBandControls';
import { NoAccessState } from './files/NoAccessState';

type Props = {
  onOpenFile: (file: RecentFile, toolId?: ToolId) => void;
  /** Increments each time Home asks Files to focus its search field. */
  focusSearchToken?: number;
};

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'size_desc' | 'size_asc';

const SORT_LABELS: Record<SortOption, { en: string; hi: string }> = {
  date_desc: { en: 'Newest first', hi: 'नई पहले' },
  date_asc: { en: 'Oldest first', hi: 'पुरानी पहले' },
  name_asc: { en: 'Name (A to Z)', hi: 'नाम (A-Z)' },
  name_desc: { en: 'Name (Z to A)', hi: 'नाम (Z-A)' },
  size_desc: { en: 'Largest first', hi: 'बड़ी पहले' },
  size_asc: { en: 'Smallest first', hi: 'छोटी पहले' },
};

const GROUP_LABELS: Record<RecencyKey, { en: string; hi: string }> = {
  today: { en: 'Today', hi: 'आज' },
  week: { en: 'This week', hi: 'इस हफ़्ते' },
  earlier: { en: 'Earlier', hi: 'पहले' },
};

function classifyCategory(
  folder?: string,
  path?: string,
  name?: string,
): 'downloads' | 'whatsapp' | 'documents' | 'other' {
  const combined = `${folder ?? ''} ${path ?? ''} ${name ?? ''}`.toLowerCase();
  if (combined.includes('download')) return 'downloads';
  if (combined.includes('whatsapp') || combined.includes('telegram') || combined.includes('media'))
    return 'whatsapp';
  if (combined.includes('document') || combined.includes('camscanner') || combined.includes('scan'))
    return 'documents';
  return 'other';
}

// In-memory module-level cache for scanned device files to avoid rescanning on every tab switch
let cachedScannedDeviceFiles: RecentFile[] | null = null;
let isScanRunning = false;
// URIs whose thumbnail could not be rendered (damaged, encrypted or half-downloaded PDFs).
// Kept for the session so a failing file isn't re-rendered every time the list re-renders.
const failedThumbnailUris = new Set<string>();
// Unopened device files above this size (bytes) get the placeholder icon instead of a
// rendered thumbnail: parsing a very large PDF just to draw a 40dp preview isn't worth it.
const MAX_THUMBNAIL_SOURCE_BYTES = 50 * 1024 * 1024;

/** Files tab: brand band with search and source tabs, then device and recent PDFs by date. */
export function FilesScreen({ onOpenFile, focusSearchToken = 0 }: Props) {
  const ui = useUi();
  const tx = useTx();
  const searchInputRef = useRef<TextInput>(null);
  const [activeCategory, setActiveCategory] = useState<SourceTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [activeMenuFile, setActiveMenuFile] = useState<RecentFile | null>(null);
  // Reference time (epoch ms) for date groups and relative times; refreshed on resume and pull.
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [deviceFiles, setDeviceFiles] = useState<RecentFile[]>(cachedScannedDeviceFiles ?? []);
  const [scanning, setScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // In-memory thumbnail and pageCount cache
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, string>>({});
  const [pageCountCache, setPageCountCache] = useState<Record<string, number>>({});
  const renderingRefs = useRef<Set<string>>(new Set());

  const files = useRecentFilesStore((state) => state.files);
  const addFile = useRecentFilesStore((state) => state.addFile);
  const bandListRef = useRef<SectionList<RecentFile, { key: string; title: string }>>(null);
  const band = useBandCollapse(
    useCallback(
      (y) => bandListRef.current?.getScrollResponder()?.scrollTo({ y, animated: true }),
      [],
    ),
  );
  const toggleStar = useRecentFilesStore((state) => state.toggleStar);
  const removeFile = useRecentFilesStore((state) => state.removeFile);

  const scanFiles = useCallback(async (force = false) => {
    if (isScanRunning) return;
    isScanRunning = true;
    setScanning(true);

    try {
      if (!force && cachedScannedDeviceFiles !== null) {
        setDeviceFiles(cachedScannedDeviceFiles);
        return;
      }

      const scanned = await scanDevicePdfFiles();
      const mapped: RecentFile[] = scanned.map((item) => {
        const modifiedMs = secondsToMs(item.dateModified);
        const dateStr = modifiedMs
          ? new Date(modifiedMs).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : 'Storage';
        const folderName = item.path
          ? item.path.split('/').slice(-2, -1)[0] || 'Storage'
          : 'Storage';

        return {
          id: `dev-${item.uri}`,
          name: item.name,
          hindiName: item.name.replace(/\.pdf$/i, '') + '_हिंदी.pdf',
          uri: item.uri,
          sizeBytes: item.sizeBytes,
          date: dateStr,
          dateModified: modifiedMs,
          folder: folderName,
          path: item.path,
          pageCount: item.pageCount ?? 1,
          category: 'all',
          starred: false,
          isRecent: false,
        };
      });

      cachedScannedDeviceFiles = mapped;
      setDeviceFiles(mapped);
    } catch (err) {
      console.warn('Device PDF scan error', err);
    } finally {
      isScanRunning = false;
      setScanning(false);
    }
  }, []);

  const handleAskPermission = useCallback(async () => {
    try {
      const granted = await requestStoragePermission();
      setHasPermission(granted);
      if (granted) {
        await scanFiles(true);
      }
    } catch (err) {
      console.warn('Storage permission error', err);
    }
  }, [scanFiles]);

  // Home's search pill bumps the token; focus the band's search field each time it does.
  useEffect(() => {
    if (focusSearchToken > 0) searchInputRef.current?.focus();
  }, [focusSearchToken]);

  // Initial load check
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const has = await hasStoragePermission();
        if (mounted) {
          setHasPermission(has);
          if (has) {
            await scanFiles(false);
          }
        }
      } catch {
        if (mounted) setHasPermission(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [scanFiles]);

  // Listen to app foregrounding to re-check permission if user went to settings
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setNowMs(Date.now());
        void hasStoragePermission().then((has) => {
          setHasPermission(has);
          if (has && cachedScannedDeviceFiles === null) {
            void scanFiles(false);
          }
        });
      }
    });
    return () => sub.remove();
  }, [scanFiles]);

  // Without storage access the band hides the source tabs and only the app's own files are listed.
  const noAccess = hasPermission === false;
  const category: SourceTab = noAccess ? 'all' : activeCategory;

  // Combine recent files store + scanned device storage files, removing duplicates by URI
  const mergedFiles: RecentFile[] = useMemo(() => {
    const recentMap = new Map<string, RecentFile>();
    for (const f of files) {
      recentMap.set(f.uri, { ...f, isRecent: true });
    }

    const otherDeviceList: RecentFile[] = [];
    for (const f of noAccess ? [] : deviceFiles) {
      if (!recentMap.has(f.uri)) {
        otherDeviceList.push(f);
      }
    }

    const recentList = Array.from(recentMap.values());

    // Recent files always at top, followed by all device files
    return [...recentList, ...otherDeviceList];
  }, [files, deviceFiles, noAccess]);

  // Filter files by category and search query
  const filteredFiles: RecentFile[] = useMemo(() => {
    return mergedFiles.filter((file) => {
      // 1. Category Filter
      if (category === 'starred' && !file.starred) return false;
      if (category === 'downloads') {
        const cat = classifyCategory(file.folder, file.path, file.name);
        if (cat !== 'downloads' && file.category !== 'downloads') return false;
      }
      if (category === 'whatsapp') {
        const cat = classifyCategory(file.folder, file.path, file.name);
        if (cat !== 'whatsapp') return false;
      }
      if (category === 'documents') {
        const cat = classifyCategory(file.folder, file.path, file.name);
        if (cat !== 'documents') return false;
      }

      // 2. Search query filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchName = file.name.toLowerCase().includes(q);
        const matchHi = file.hindiName?.toLowerCase().includes(q);
        const matchFolder = file.folder?.toLowerCase().includes(q);
        return matchName || matchHi || matchFolder;
      }

      return true;
    });
  }, [mergedFiles, category, searchQuery]);

  // Sort filtered files — keeping recent files at the top in default date view
  const sortedFiles: RecentFile[] = useMemo(() => {
    const list = [...filteredFiles];
    list.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc': {
          // Keep recently opened files on top
          if (a.isRecent && !b.isRecent) return -1;
          if (!a.isRecent && b.isRecent) return 1;
          const tA = fileTimeMs(a) || 0;
          const tB = fileTimeMs(b) || 0;
          return tB - tA;
        }
        case 'date_asc': {
          const tA = fileTimeMs(a) || 0;
          const tB = fileTimeMs(b) || 0;
          return tA - tB;
        }
        case 'name_asc':
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        case 'name_desc':
          return b.name.localeCompare(a.name, undefined, { sensitivity: 'base' });
        case 'size_desc':
          return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
        case 'size_asc':
          return (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0);
        default:
          return 0;
      }
    });
    return list;
  }, [filteredFiles, sortBy]);

  // Lazy render thumbnail for a file if missing
  const lazyLoadThumbnail = useCallback(
    async (file: RecentFile) => {
      if (
        !file.uri ||
        thumbnailCache[file.uri] ||
        renderingRefs.current.has(file.uri) ||
        failedThumbnailUris.has(file.uri) ||
        (!file.isRecent && (file.sizeBytes ?? 0) > MAX_THUMBNAIL_SOURCE_BYTES)
      ) {
        return;
      }
      renderingRefs.current.add(file.uri);
      try {
        const [thumb, count] = await Promise.all([
          renderPage(file.uri, 0, 0.35).catch(() => null),
          pageCountCache[file.uri]
            ? Promise.resolve(pageCountCache[file.uri])
            : getPageCount(file.uri).catch(() => null),
        ]);

        if (thumb?.uri) {
          setThumbnailCache((prev) => ({ ...prev, [file.uri]: thumb.uri }));
        } else {
          failedThumbnailUris.add(file.uri);
        }
        if (count && count > 0) {
          setPageCountCache((prev) => ({ ...prev, [file.uri]: count }));
        }
      } catch {
        // Thumbnail generation optional
      } finally {
        renderingRefs.current.delete(file.uri);
      }
    },
    [thumbnailCache, pageCountCache],
  );

  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) return;
      const asset = res.assets[0];
      const count = await getPageCount(asset.uri).catch(() => 1);
      let thumbUri: string | undefined;
      try {
        const thumb = await renderPage(asset.uri, 0, 0.4);
        thumbUri = thumb.uri;
      } catch {
        // Thumbnail optional
      }

      const newFile: Omit<RecentFile, 'id' | 'date'> = {
        name: asset.name,
        hindiName: asset.name.replace(/\.pdf$/i, '') + '_हिंदी.pdf',
        uri: asset.uri,
        thumbnailUri: thumbUri,
        sizeBytes: asset.size ?? 0,
        pageCount: count,
        category: 'all',
        starred: false,
        folder: 'Picked',
      };
      await addFile(newFile);
      onOpenFile(
        {
          ...newFile,
          id: `picked-${Date.now()}`,
          date: 'Today',
        },
        'edit',
      );
    } catch {
      // User cancelled
    }
  };

  const handleShareFile = async (file: RecentFile) => {
    if (!file.uri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: tx(`Share ${file.name}`, `${file.name} शेयर करें`),
        });
      }
    } catch {
      // Ignored
    }
  };

  const handleToggleStar = async (file: RecentFile) => {
    if (files.some((f) => f.id === file.id)) {
      await toggleStar(file.id);
    } else {
      await addFile({
        name: file.name,
        hindiName: file.hindiName,
        uri: file.uri,
        thumbnailUri: thumbnailCache[file.uri] || file.thumbnailUri,
        sizeBytes: file.sizeBytes,
        pageCount: pageCountCache[file.uri] || file.pageCount,
        folder: file.folder,
        path: file.path,
        dateModified: file.dateModified,
        category: 'starred',
        starred: true,
      });
    }
  };

  const sections = useMemo(
    () =>
      groupByRecency(sortedFiles, fileTimeMs, nowMs).map((group) => ({
        key: group.key,
        title: tx(GROUP_LABELS[group.key].en, GROUP_LABELS[group.key].hi),
        data: group.items,
      })),
    [sortedFiles, tx, nowMs],
  );

  const noAccessCard = (
    <NoAccessState
      onAllow={() => void handleAskPermission()}
      onPick={() => void handlePickFile()}
    />
  );

  const closeMenuThen = (action: (file: RecentFile) => void) => {
    const file = activeMenuFile;
    setActiveMenuFile(null);
    if (file) action(file);
  };

  const renderFileItem = ({ item: file }: { item: RecentFile }) => {
    const thumbUri = thumbnailCache[file.uri] || file.thumbnailUri;
    const pageCount = pageCountCache[file.uri] || file.pageCount || 1;

    // Trigger lazy thumbnail on display
    if (!thumbUri && file.uri) {
      void lazyLoadThumbnail(file);
    }

    return (
      <FileRow
        file={file}
        thumbUri={thumbUri}
        pageCount={pageCount}
        nowMs={nowMs}
        onOpen={() => onOpenFile(file, 'viewer')}
        onToggleStar={() => void handleToggleStar(file)}
        onMore={() => setActiveMenuFile(file)}
      />
    );
  };

  return (
    <>
      <BrandBand
        title={tx('Files', 'फ़ाइलें')}
        scrollY={band.scrollY}
        onCollapseDistance={band.setDistance}
        actions={
          <>
            <BandIconButton
              icon="sort"
              label={tx('Sort', 'क्रम बदलें')}
              onPress={() => setShowSortSheet(true)}
            />
            <BandIconButton
              icon="more-vert"
              label={tx('More options', 'और विकल्प')}
              onPress={() => setShowMoreSheet(true)}
            />
          </>
        }
        bandExtra={
          <>
            <BandSearchField
              inputRef={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {noAccess ? null : <SourceTabs active={activeCategory} onChange={setActiveCategory} />}
          </>
        }
      >
        {noAccess && files.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center' }}>{noAccessCard}</View>
        ) : (
          <SectionList
            sections={sections}
            onScroll={band.onScroll}
            scrollEventThrottle={band.scrollEventThrottle}
            ref={bandListRef}
            onScrollEndDrag={band.onScrollEndDrag}
            onMomentumScrollEnd={band.onMomentumScrollEnd}
            keyExtractor={(item) => item.id}
            renderItem={renderFileItem}
            renderSectionHeader={({ section }) => (
              <UiText
                accessibilityRole="header"
                color={ui.inkLabel}
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 4,
                }}
              >
                {section.title}
              </UiText>
            )}
            ListHeaderComponent={noAccess ? noAccessCard : null}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 24, flexGrow: 1 }}
            initialNumToRender={12}
            maxToRenderPerBatch={10}
            windowSize={7}
            refreshControl={
              noAccess ? undefined : (
                <RefreshControl
                  refreshing={scanning}
                  onRefresh={() => {
                    setNowMs(Date.now());
                    void scanFiles(true);
                  }}
                  colors={[ui.brand]}
                  tintColor={ui.brand}
                />
              )
            }
            ListEmptyComponent={
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 32,
                  gap: 16,
                }}
              >
                <Icon name="folder-open" size={56} color={ui.inkTertiary} />
                <UiText color={ui.inkSecondary} style={{ textAlign: 'center' }}>
                  {searchQuery
                    ? tx('No PDFs match your search', 'खोज से कोई PDF नहीं मिली')
                    : tx('No PDFs here yet', 'यहाँ अभी कोई PDF नहीं है')}
                </UiText>
                <PillButton
                  title={tx('Pick a file', 'फ़ाइल चुनें')}
                  kind="tonal"
                  icon="file-open"
                  onPress={() => void handlePickFile()}
                />
              </View>
            }
          />
        )}
      </BrandBand>

      <BottomSheet
        visible={activeMenuFile !== null}
        onClose={() => setActiveMenuFile(null)}
        title={activeMenuFile?.name}
      >
        <View style={{ paddingTop: 8 }}>
          <ListRow
            icon="menu-book"
            title={tx('Open', 'खोलें')}
            onPress={() => closeMenuThen((file) => onOpenFile(file, 'viewer'))}
          />
          <ListRow
            icon="edit"
            title={tx('Edit', 'एडिट करें')}
            onPress={() => closeMenuThen((file) => onOpenFile(file, 'edit'))}
          />
          <ListRow
            icon="share"
            title={tx('Share', 'शेयर करें')}
            onPress={() => closeMenuThen((file) => void handleShareFile(file))}
          />
          {activeMenuFile?.isRecent ? (
            <ListRow
              icon="delete-outline"
              title={tx('Remove from list', 'सूची से हटाएँ')}
              onPress={() => closeMenuThen((file) => void removeFile(file.id))}
            />
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={showSortSheet}
        onClose={() => setShowSortSheet(false)}
        title={tx('Sort by', 'क्रम')}
      >
        <View style={{ paddingTop: 8 }}>
          {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => (
            <ListRow
              key={key}
              title={tx(SORT_LABELS[key].en, SORT_LABELS[key].hi)}
              trailing={
                sortBy === key ? (
                  <Icon
                    name="check"
                    size={24}
                    color={ui.brandOnSurface}
                    label={tx('Selected', 'चुना गया')}
                  />
                ) : null
              }
              onPress={() => {
                setSortBy(key);
                setShowSortSheet(false);
              }}
            />
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={showMoreSheet} onClose={() => setShowMoreSheet(false)}>
        <ListRow
          icon="file-open"
          title={tx('Pick a file', 'फ़ाइल चुनें')}
          onPress={() => {
            setShowMoreSheet(false);
            void handlePickFile();
          }}
        />
        {noAccess ? null : (
          <ListRow
            icon="refresh"
            title={tx('Scan phone again', 'फ़ोन फिर से खोजें')}
            onPress={() => {
              setShowMoreSheet(false);
              void scanFiles(true);
            }}
          />
        )}
      </BottomSheet>
    </>
  );
}
