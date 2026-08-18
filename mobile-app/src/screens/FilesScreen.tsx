import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import type { ToolId } from '../components/ToolShell';
import {
  getPageCount,
  hasStoragePermission,
  renderPage,
  requestStoragePermission,
  scanDevicePdfFiles,
} from '../lib/pdfToImages';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { colors, radius, shadows, spacing } from '../theme';

type Props = {
  onOpenFile: (file: RecentFile, toolId?: ToolId) => void;
};

type FileCategoryTab = 'all' | 'downloads' | 'whatsapp' | 'documents' | 'starred';

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'size_desc' | 'size_asc';

const SORT_LABELS: Record<SortOption, { label: string; hindi: string; icon: string }> = {
  date_desc: { label: 'Newest First', hindi: 'नवीनतम पहले', icon: '🕒↓' },
  date_asc: { label: 'Oldest First', hindi: 'पुराने पहले', icon: '🕒↑' },
  name_asc: { label: 'Name (A to Z)', hindi: 'नाम (A-Z)', icon: '🔤↓' },
  name_desc: { label: 'Name (Z to A)', hindi: 'नाम (Z-A)', icon: '🔤↑' },
  size_desc: { label: 'Largest Size', hindi: 'बड़ा साइज', icon: '💾↓' },
  size_asc: { label: 'Smallest Size', hindi: 'छोटा साइज', icon: '💾↑' },
};

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(epochSecOrStr?: number | string): string {
  if (!epochSecOrStr) return 'Recent';
  if (typeof epochSecOrStr === 'number') {
    return new Date(epochSecOrStr * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return epochSecOrStr;
}

function getFolderIcon(folderName?: string): string {
  if (!folderName) return '📁';
  const f = folderName.toLowerCase();
  if (f.includes('download')) return '📥';
  if (f.includes('whatsapp') || f.includes('chat') || f.includes('telegram')) return '💬';
  if (f.includes('camscanner') || f.includes('scan') || f.includes('adobe')) return '📷';
  if (f.includes('document')) return '📄';
  return '📁';
}

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

export function FilesScreen({ onOpenFile }: Props) {
  const [activeCategory, setActiveCategory] = useState<FileCategoryTab>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [showSortModal, setShowSortModal] = useState(false);
  const [selectedDetailsFile, setSelectedDetailsFile] = useState<RecentFile | null>(null);
  const [activeMenuFile, setActiveMenuFile] = useState<RecentFile | null>(null);

  const [deviceFiles, setDeviceFiles] = useState<RecentFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // In-memory thumbnail and pageCount cache
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, string>>({});
  const [pageCountCache, setPageCountCache] = useState<Record<string, number>>({});
  const renderingRefs = useRef<Set<string>>(new Set());

  const files = useRecentFilesStore((state) => state.files);
  const addFile = useRecentFilesStore((state) => state.addFile);
  const toggleStar = useRecentFilesStore((state) => state.toggleStar);
  const removeFile = useRecentFilesStore((state) => state.removeFile);

  const scanFiles = useCallback(async () => {
    setScanning(true);
    try {
      if (Platform.OS === 'android') {
        const isGranted = await hasStoragePermission();
        setHasPermission(isGranted);
        if (!isGranted) {
          setScanning(false);
          return;
        }
      } else {
        setHasPermission(true);
      }

      // Query native module for all device PDF files
      const scanned = await scanDevicePdfFiles();
      const mapped: RecentFile[] = scanned.map((item) => {
        const dateStr = formatDate(item.dateModified);
        const folderName = item.folder ?? 'Storage';

        return {
          id: `dev-${item.uri}`,
          name: item.name,
          hindiName: item.name.replace(/\.pdf$/i, '') + '_हिंदी.pdf',
          uri: item.uri,
          sizeBytes: item.sizeBytes,
          date: dateStr,
          dateModified: item.dateModified,
          folder: folderName,
          path: item.path,
          pageCount: item.pageCount ?? 1,
          category: 'all',
          starred: false,
        };
      });

      setDeviceFiles(mapped);
    } catch (err) {
      console.warn('Device PDF scan error', err);
    } finally {
      setScanning(false);
    }
  }, []);

  const handleAskPermission = useCallback(async () => {
    try {
      const granted = await requestStoragePermission();
      setHasPermission(granted);
      if (granted) {
        void scanFiles();
      }
    } catch (err) {
      console.warn('Permission request error', err);
    }
  }, [scanFiles]);

  useEffect(() => {
    let isMounted = true;

    async function checkPermissionAndScan() {
      if (isMounted) setScanning(true);
      try {
        if (Platform.OS === 'android') {
          const isGranted = await hasStoragePermission();
          if (isMounted) setHasPermission(isGranted);
          if (isGranted) {
            const scanned = await scanDevicePdfFiles();
            const mapped: RecentFile[] = scanned.map((item) => {
              const dateStr = formatDate(item.dateModified);
              const folderName = item.folder ?? 'Storage';

              return {
                id: `dev-${item.uri}`,
                name: item.name,
                hindiName: item.name.replace(/\.pdf$/i, '') + '_हिंदी.pdf',
                uri: item.uri,
                sizeBytes: item.sizeBytes,
                date: dateStr,
                dateModified: item.dateModified,
                folder: folderName,
                path: item.path,
                pageCount: item.pageCount ?? 1,
                category: 'all',
                starred: false,
                isRecent: false,
              };
            });

            if (isMounted) {
              setDeviceFiles(mapped);
            }
          } else {
            // Prompt the user for permission every time on the files screen until granted
            try {
              const asked = await requestStoragePermission();
              if (isMounted) {
                setHasPermission(asked);
                if (asked) {
                  const scanned = await scanDevicePdfFiles();
                  const mapped: RecentFile[] = scanned.map((item) => ({
                    id: `dev-${item.uri}`,
                    name: item.name,
                    hindiName: item.name.replace(/\.pdf$/i, '') + '_हिंदी.pdf',
                    uri: item.uri,
                    sizeBytes: item.sizeBytes,
                    date: formatDate(item.dateModified),
                    dateModified: item.dateModified,
                    folder: item.folder ?? 'Storage',
                    path: item.path,
                    pageCount: item.pageCount ?? 1,
                    category: 'all',
                    starred: false,
                    isRecent: false,
                  }));
                  setDeviceFiles(mapped);
                }
              }
            } catch {
              // ignore
            }
          }
        } else {
          if (isMounted) setHasPermission(true);
          const scanned = await scanDevicePdfFiles();
          const mapped: RecentFile[] = scanned.map((item) => ({
            id: `dev-${item.uri}`,
            name: item.name,
            hindiName: item.name.replace(/\.pdf$/i, '') + '_हिंदी.pdf',
            uri: item.uri,
            sizeBytes: item.sizeBytes,
            date: formatDate(item.dateModified),
            dateModified: item.dateModified,
            folder: item.folder ?? 'Storage',
            path: item.path,
            pageCount: item.pageCount ?? 1,
            category: 'all',
            starred: false,
            isRecent: false,
          }));
          if (isMounted) setDeviceFiles(mapped);
        }
      } catch (err) {
        console.warn('Initial PDF scan error', err);
      } finally {
        if (isMounted) setScanning(false);
      }
    }

    void checkPermissionAndScan();

    // Re-check every time app returns to foreground from Settings / Permission screen
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        void checkPermissionAndScan();
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  // Combine recent files store + scanned device files with RECENT FILES ALWAYS ON TOP
  const mergedFiles: RecentFile[] = useMemo(() => {
    const recentUris = new Set(files.map((f) => f.uri));
    const recentNamesAndSizes = new Set(files.map((f) => `${f.name}-${f.sizeBytes}`));

    const recentList: RecentFile[] = files.map((f) => ({ ...f, isRecent: true }));
    const otherDeviceList: RecentFile[] = [];

    for (const df of deviceFiles) {
      const key = `${df.name}-${df.sizeBytes}`;
      if (!recentUris.has(df.uri) && !recentNamesAndSizes.has(key)) {
        otherDeviceList.push({ ...df, isRecent: false });
      }
    }

    // Recent files always at top, followed by all device files
    return [...recentList, ...otherDeviceList];
  }, [files, deviceFiles]);

  // Extract detected folders and their file counts
  const folderStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const file of mergedFiles) {
      const f = file.folder?.trim() || 'Storage';
      map.set(f, (map.get(f) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [mergedFiles]);

  // Filter files by category, folder, and search query
  const filteredFiles: RecentFile[] = useMemo(() => {
    return mergedFiles.filter((file) => {
      // 1. Category Filter
      if (activeCategory === 'starred' && !file.starred) return false;
      if (activeCategory === 'downloads') {
        const cat = classifyCategory(file.folder, file.path, file.name);
        if (cat !== 'downloads' && file.category !== 'downloads') return false;
      }
      if (activeCategory === 'whatsapp') {
        const cat = classifyCategory(file.folder, file.path, file.name);
        if (cat !== 'whatsapp') return false;
      }
      if (activeCategory === 'documents') {
        const cat = classifyCategory(file.folder, file.path, file.name);
        if (cat !== 'documents') return false;
      }

      // 2. Folder filter
      if (selectedFolder && (file.folder?.trim() || 'Storage') !== selectedFolder) {
        return false;
      }

      // 3. Search query filter
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchName = file.name.toLowerCase().includes(q);
        const matchHi = file.hindiName?.toLowerCase().includes(q);
        const matchFolder = file.folder?.toLowerCase().includes(q);
        return matchName || matchHi || matchFolder;
      }

      return true;
    });
  }, [mergedFiles, activeCategory, selectedFolder, searchQuery]);

  // Sort filtered files — keeping recent files at the top in default date view
  const sortedFiles: RecentFile[] = useMemo(() => {
    const list = [...filteredFiles];
    list.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc': {
          // Keep recently opened files on top
          if (a.isRecent && !b.isRecent) return -1;
          if (!a.isRecent && b.isRecent) return 1;
          const tA = a.dateModified ?? (a.date ? new Date(a.date).getTime() : 0);
          const tB = b.dateModified ?? (b.date ? new Date(b.date).getTime() : 0);
          return tB - tA;
        }
        case 'date_asc': {
          const tA = a.dateModified ?? (a.date ? new Date(a.date).getTime() : 0);
          const tB = b.dateModified ?? (b.date ? new Date(b.date).getTime() : 0);
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
      if (!file.uri || thumbnailCache[file.uri] || renderingRefs.current.has(file.uri)) return;
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
          dialogTitle: `Share ${file.name}`,
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

  const renderFileItem = ({ item: file }: { item: RecentFile }) => {
    const thumbUri = thumbnailCache[file.uri] || file.thumbnailUri;
    const pageCount = pageCountCache[file.uri] || file.pageCount || 1;
    const folderIcon = getFolderIcon(file.folder);
    const folderDisplayName = file.folder || 'Storage';

    // Trigger lazy thumbnail on display
    if (!thumbUri && file.uri) {
      void lazyLoadThumbnail(file);
    }

    return (
      <View style={styles.fileCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${file.name}`}
          onPress={() => onOpenFile(file, 'viewer')}
          style={({ pressed }) => [styles.fileCardBody, pressed && styles.fileCardPressed]}
        >
          {/* Thumbnail / PDF Preview */}
          <View style={styles.fileThumbnail}>
            {thumbUri ? (
              <Image source={{ uri: thumbUri }} style={styles.thumbImage} resizeMode="cover" />
            ) : (
              <View style={styles.thumbPlaceholder}>
                <Text style={styles.thumbPdfText}>PDF</Text>
                <View style={styles.thumbLines}>
                  <View style={styles.thumbLine} />
                  <View style={[styles.thumbLine, { width: '60%' }]} />
                  <View style={[styles.thumbLine, { width: '80%' }]} />
                </View>
              </View>
            )}

            {/* Page Count Badge on Thumbnail */}
            <View style={styles.thumbPageBadge}>
              <Text style={styles.thumbPageBadgeText}>
                {pageCount} {pageCount === 1 ? 'pg' : 'pgs'}
              </Text>
            </View>
          </View>

          {/* Details */}
          <View style={styles.fileDetails}>
            <Text style={styles.fileNameEn} numberOfLines={2}>
              {file.name}
            </Text>
            {file.hindiName && (
              <Text style={styles.fileNameHi} numberOfLines={1}>
                {file.hindiName}
              </Text>
            )}

            {/* Tag Pills Row */}
            <View style={styles.fileMetaRow}>
              {file.isRecent && (
                <>
                  <View style={styles.recentPill}>
                    <Text style={styles.recentPillText}>🕒 Recent</Text>
                  </View>
                  <Text style={styles.fileMetaDot}>•</Text>
                </>
              )}
              <View style={styles.folderPill}>
                <Text style={styles.folderPillIcon}>{folderIcon}</Text>
                <Text style={styles.folderPillText} numberOfLines={1}>
                  {folderDisplayName}
                </Text>
              </View>
              <Text style={styles.fileMetaDot}>•</Text>
              <Text style={styles.fileMetaText}>{formatFileSize(file.sizeBytes)}</Text>
              <Text style={styles.fileMetaDot}>•</Text>
              <Text style={styles.fileMetaText}>{file.date}</Text>
            </View>
          </View>
        </Pressable>

        {/* Right Side Quick Actions: Star + More Menu */}
        <View style={styles.cardActionsRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={file.starred ? 'Unstar file' : 'Star file'}
            onPress={() => void handleToggleStar(file)}
            style={({ pressed }) => [styles.starBtn, pressed && styles.actionBtnPressed]}
            hitSlop={8}
          >
            <Text style={[styles.starIcon, file.starred && styles.starIconActive]}>
              {file.starred ? '★' : '☆'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="File actions"
            onPress={() => setActiveMenuFile(file)}
            style={({ pressed }) => [styles.moreBtn, pressed && styles.actionBtnPressed]}
            hitSlop={8}
          >
            <Text style={styles.moreBtnText}>•••</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerLogoBadge}>
            <Text style={styles.headerLogoHindi}>ह</Text>
          </View>
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>
              Files / <Text style={styles.headerTitleHindi}>फाइलें</Text>
            </Text>
            <Text style={styles.headerSub}>
              {scanning
                ? 'Scanning all device folders...'
                : `${mergedFiles.length} PDF files found on device`}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* Rescan Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rescan device storage"
            onPress={() => void scanFiles()}
            disabled={scanning}
            style={({ pressed }) => [styles.rescanBtn, pressed && styles.rescanBtnPressed]}
          >
            {scanning ? (
              <ActivityIndicator size="small" color={colors.brand} />
            ) : (
              <Text style={styles.rescanBtnText}>🔄 Rescan</Text>
            )}
          </Pressable>

          {/* Quick Pick PDF Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Import new PDF"
            onPress={handlePickFile}
            style={({ pressed }) => [styles.pickPdfBtn, pressed && styles.pickPdfBtnPressed]}
          >
            <Text style={styles.pickPdfBtnText}>+ Open PDF</Text>
          </Pressable>
        </View>
      </View>

      {/* Permission Request Alert Card if denied */}
      {hasPermission === false && (
        <View style={styles.permissionCard}>
          <Text style={styles.permissionIcon}>⚠️</Text>
          <View style={styles.permissionTextGroup}>
            <Text style={styles.permissionTitle}>Device Storage Access Needed</Text>
            <Text style={styles.permissionDesc}>
              Grant storage permission so Hindi PDF Editor can automatically scan and list all PDF
              documents stored on your phone.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void handleAskPermission()}
            style={styles.permissionBtn}
          >
            <Text style={styles.permissionBtnText}>Allow</Text>
          </Pressable>
        </View>
      )}

      {/* Search Bar & Sort Button Row */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search all device files / खोजें..."
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Text style={styles.clearSearchText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Sort Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sort files"
          onPress={() => setShowSortModal(true)}
          style={({ pressed }) => [styles.sortBtn, pressed && styles.sortBtnPressed]}
        >
          <Text style={styles.sortBtnIcon}>{SORT_LABELS[sortBy].icon}</Text>
          <Text style={styles.sortBtnText}>Sort</Text>
        </Pressable>
      </View>

      {/* Primary Category Filter Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeCategory === 'all' }}
          onPress={() => {
            setActiveCategory('all');
            setSelectedFolder(null);
          }}
          style={[styles.tabItem, activeCategory === 'all' && styles.tabItemActive]}
        >
          <Text style={[styles.tabTextEn, activeCategory === 'all' && styles.tabTextActive]}>
            All ({mergedFiles.length})
          </Text>
          <Text style={[styles.tabTextHi, activeCategory === 'all' && styles.tabTextActive]}>
            सभी PDF
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeCategory === 'downloads' }}
          onPress={() => {
            setActiveCategory('downloads');
            setSelectedFolder(null);
          }}
          style={[styles.tabItem, activeCategory === 'downloads' && styles.tabItemActive]}
        >
          <Text style={[styles.tabTextEn, activeCategory === 'downloads' && styles.tabTextActive]}>
            Downloads
          </Text>
          <Text style={[styles.tabTextHi, activeCategory === 'downloads' && styles.tabTextActive]}>
            डाउनलोड
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeCategory === 'whatsapp' }}
          onPress={() => {
            setActiveCategory('whatsapp');
            setSelectedFolder(null);
          }}
          style={[styles.tabItem, activeCategory === 'whatsapp' && styles.tabItemActive]}
        >
          <Text style={[styles.tabTextEn, activeCategory === 'whatsapp' && styles.tabTextActive]}>
            WhatsApp
          </Text>
          <Text style={[styles.tabTextHi, activeCategory === 'whatsapp' && styles.tabTextActive]}>
            व्हाट्सएप
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeCategory === 'documents' }}
          onPress={() => {
            setActiveCategory('documents');
            setSelectedFolder(null);
          }}
          style={[styles.tabItem, activeCategory === 'documents' && styles.tabItemActive]}
        >
          <Text style={[styles.tabTextEn, activeCategory === 'documents' && styles.tabTextActive]}>
            Documents
          </Text>
          <Text style={[styles.tabTextHi, activeCategory === 'documents' && styles.tabTextActive]}>
            दस्तावेज़
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeCategory === 'starred' }}
          onPress={() => {
            setActiveCategory('starred');
            setSelectedFolder(null);
          }}
          style={[styles.tabItem, activeCategory === 'starred' && styles.tabItemActive]}
        >
          <Text style={[styles.tabTextEn, activeCategory === 'starred' && styles.tabTextActive]}>
            Starred
          </Text>
          <Text style={[styles.tabTextHi, activeCategory === 'starred' && styles.tabTextActive]}>
            पसंदीदा
          </Text>
        </Pressable>
      </View>

      {/* Horizontal Folder Chip Filter Row */}
      {folderStats.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.folderChipsScroll}
          contentContainerStyle={styles.folderChipsContent}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelectedFolder(null)}
            style={[styles.folderChip, selectedFolder === null && styles.folderChipActive]}
          >
            <Text
              style={[
                styles.folderChipText,
                selectedFolder === null && styles.folderChipTextActive,
              ]}
            >
              All Folders ({mergedFiles.length})
            </Text>
          </Pressable>

          {folderStats.map(([folderName, count]) => {
            const isSelected = selectedFolder === folderName;
            const icon = getFolderIcon(folderName);
            return (
              <Pressable
                key={folderName}
                accessibilityRole="button"
                onPress={() => setSelectedFolder(isSelected ? null : folderName)}
                style={[styles.folderChip, isSelected && styles.folderChipActive]}
              >
                <Text style={styles.folderChipIcon}>{icon}</Text>
                <Text
                  style={[styles.folderChipText, isSelected && styles.folderChipTextActive]}
                  numberOfLines={1}
                >
                  {folderName} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Results Subtitle Banner */}
      <View style={styles.resultStatusRow}>
        <Text style={styles.resultStatusText}>
          Showing {sortedFiles.length} of {mergedFiles.length} documents
          {selectedFolder ? ` in "${selectedFolder}"` : ''}
          {searchQuery ? ` matching "${searchQuery}"` : ''}
        </Text>
        <Text style={styles.sortIndicatorText}>{SORT_LABELS[sortBy].label}</Text>
      </View>

      {/* Virtualized FlatList for High Performance */}
      <FlatList
        data={sortedFiles}
        keyExtractor={(item) => item.id}
        renderItem={renderFileItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={scanning}
            onRefresh={() => void scanFiles()}
            colors={[colors.brand]}
            tintColor={colors.brand}
          />
        }
        ListEmptyComponent={
          hasPermission === false ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔒</Text>
              <Text style={styles.emptyTitle}>Storage Permission Required / अनुमति आवश्यक</Text>
              <Text style={styles.emptySubtitle}>
                Allow storage permission so Hindi PDF Editor can automatically list all PDF files
                saved in your Downloads, WhatsApp, and storage folders.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void handleAskPermission()}
                style={styles.emptyPickBtn}
              >
                <Text style={styles.emptyPickBtnText}>
                  🔓 Grant Storage Permission / अनुमति दें
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={handlePickFile}
                style={[styles.emptyPickBtn, styles.emptyPickSecondaryBtn]}
              >
                <Text style={[styles.emptyPickBtnText, styles.emptyPickSecondaryBtnText]}>
                  + Select Single PDF File
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📁</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'No matching PDF files found' : 'No documents in this view'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Try a different search keyword or clear filters.'
                  : 'Tap below to select a PDF from your device storage or Google Drive.'}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={handlePickFile}
                style={styles.emptyPickBtn}
              >
                <Text style={styles.emptyPickBtnText}>+ Select PDF file</Text>
              </Pressable>
            </View>
          )
        }
      />

      {/* Floating Action Button (+) */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Import new PDF"
        onPress={handlePickFile}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      {/* Action Menu Modal Sheet */}
      {activeMenuFile && (
        <Modal
          visible={Boolean(activeMenuFile)}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveMenuFile(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setActiveMenuFile(null)}>
            <View style={styles.actionSheetContainer}>
              {/* Sheet Header */}
              <View style={styles.actionSheetHeader}>
                <View style={styles.actionSheetThumb}>
                  <Text style={styles.actionSheetPdfBadge}>PDF</Text>
                </View>
                <View style={styles.actionSheetHeaderDetails}>
                  <Text style={styles.actionSheetTitle} numberOfLines={1}>
                    {activeMenuFile.name}
                  </Text>
                  <Text style={styles.actionSheetSub}>
                    {formatFileSize(activeMenuFile.sizeBytes)} •{' '}
                    {activeMenuFile.folder ?? 'Storage'}
                  </Text>
                </View>
                <Pressable onPress={() => setActiveMenuFile(null)} style={styles.actionSheetClose}>
                  <Text style={styles.actionSheetCloseText}>✕</Text>
                </Pressable>
              </View>

              {/* Action Options */}
              <View style={styles.actionSheetMenu}>
                <Pressable
                  style={styles.actionOption}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'viewer');
                  }}
                >
                  <Text style={styles.actionOptionIcon}>📖</Text>
                  <View style={styles.actionOptionTextGroup}>
                    <Text style={styles.actionOptionTitle}>Read / View PDF (देखें और पढ़ें)</Text>
                    <Text style={styles.actionOptionDesc}>
                      Read comfortably with zoom, page navigation, and night mode
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.actionOption}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'edit');
                  }}
                >
                  <Text style={styles.actionOptionIcon}>✏️</Text>
                  <View style={styles.actionOptionTextGroup}>
                    <Text style={styles.actionOptionTitle}>Edit Hindi Text</Text>
                    <Text style={styles.actionOptionDesc}>
                      Edit existing Hindi words, mask lines, or add new text
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.actionOption}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'translate');
                  }}
                >
                  <Text style={styles.actionOptionIcon}>🌐</Text>
                  <View style={styles.actionOptionTextGroup}>
                    <Text style={styles.actionOptionTitle}>Translate Document</Text>
                    <Text style={styles.actionOptionDesc}>
                      Bilingual Hindi ↔ English AI translation
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.actionOption}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'compress');
                  }}
                >
                  <Text style={styles.actionOptionIcon}>🗜️</Text>
                  <View style={styles.actionOptionTextGroup}>
                    <Text style={styles.actionOptionTitle}>Compress PDF</Text>
                    <Text style={styles.actionOptionDesc}>
                      Reduce file size while preserving Hindi readability
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.actionOption}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'split');
                  }}
                >
                  <Text style={styles.actionOptionIcon}>✂️</Text>
                  <View style={styles.actionOptionTextGroup}>
                    <Text style={styles.actionOptionTitle}>Split Pages</Text>
                    <Text style={styles.actionOptionDesc}>
                      Extract page ranges or individual pages
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.actionOption}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'merge');
                  }}
                >
                  <Text style={styles.actionOptionIcon}>📑</Text>
                  <View style={styles.actionOptionTextGroup}>
                    <Text style={styles.actionOptionTitle}>Merge with other PDFs</Text>
                    <Text style={styles.actionOptionDesc}>Combine multiple PDF documents</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.actionOption}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    void handleToggleStar(file);
                  }}
                >
                  <Text style={styles.actionOptionIcon}>{activeMenuFile.starred ? '★' : '☆'}</Text>
                  <View style={styles.actionOptionTextGroup}>
                    <Text style={styles.actionOptionTitle}>
                      {activeMenuFile.starred ? 'Remove from Starred' : 'Add to Starred'}
                    </Text>
                    <Text style={styles.actionOptionDesc}>
                      Quick access in Starred favorites tab
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.actionOption}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    void handleShareFile(file);
                  }}
                >
                  <Text style={styles.actionOptionIcon}>📤</Text>
                  <View style={styles.actionOptionTextGroup}>
                    <Text style={styles.actionOptionTitle}>Share PDF</Text>
                    <Text style={styles.actionOptionDesc}>
                      Send to WhatsApp, Email, Drive, etc.
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.actionOption}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    setSelectedDetailsFile(file);
                  }}
                >
                  <Text style={styles.actionOptionIcon}>ℹ️</Text>
                  <View style={styles.actionOptionTextGroup}>
                    <Text style={styles.actionOptionTitle}>File Details & Properties</Text>
                    <Text style={styles.actionOptionDesc}>
                      View path, page count, modified timestamp
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={styles.actionOption}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    void removeFile(file.id);
                  }}
                >
                  <Text style={[styles.actionOptionIcon, { color: colors.danger }]}>🗑</Text>
                  <View style={styles.actionOptionTextGroup}>
                    <Text style={[styles.actionOptionTitle, { color: colors.danger }]}>
                      Remove from List
                    </Text>
                    <Text style={styles.actionOptionDesc}>Remove from recent files view</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Sort Options Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSortModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
          <View style={styles.sortModalCard}>
            <View style={styles.sortModalHeader}>
              <Text style={styles.sortModalTitle}>Sort Documents / क्रमबद्ध करें</Text>
              <Pressable onPress={() => setShowSortModal(false)}>
                <Text style={styles.actionSheetCloseText}>✕</Text>
              </Pressable>
            </View>

            <View style={styles.sortOptionsList}>
              {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => {
                const opt = SORT_LABELS[key];
                const isSelected = sortBy === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setSortBy(key);
                      setShowSortModal(false);
                    }}
                    style={[styles.sortItem, isSelected && styles.sortItemActive]}
                  >
                    <Text style={styles.sortItemIcon}>{opt.icon}</Text>
                    <View style={styles.sortItemTextGroup}>
                      <Text
                        style={[styles.sortItemLabel, isSelected && styles.sortItemLabelActive]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.sortItemHindi}>{opt.hindi}</Text>
                    </View>
                    {isSelected && <Text style={styles.sortItemCheck}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* File Details Properties Modal */}
      {selectedDetailsFile && (
        <Modal
          visible={Boolean(selectedDetailsFile)}
          transparent
          animationType="fade"
          onRequestClose={() => setSelectedDetailsFile(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setSelectedDetailsFile(null)}>
            <View style={styles.detailsModalCard}>
              <View style={styles.sortModalHeader}>
                <Text style={styles.sortModalTitle}>Document Details / फाइल विवरण</Text>
                <Pressable onPress={() => setSelectedDetailsFile(null)}>
                  <Text style={styles.actionSheetCloseText}>✕</Text>
                </Pressable>
              </View>

              <ScrollView style={styles.detailsBody} showsVerticalScrollIndicator={false}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>File Name</Text>
                  <Text style={styles.detailValue}>{selectedDetailsFile.name}</Text>
                </View>

                {selectedDetailsFile.hindiName && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Hindi Title</Text>
                    <Text style={styles.detailValue}>{selectedDetailsFile.hindiName}</Text>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Folder</Text>
                  <Text style={styles.detailValue}>
                    {getFolderIcon(selectedDetailsFile.folder)}{' '}
                    {selectedDetailsFile.folder ?? 'Device Storage'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>File Size</Text>
                  <Text style={styles.detailValue}>
                    {formatFileSize(selectedDetailsFile.sizeBytes)} (
                    {selectedDetailsFile.sizeBytes?.toLocaleString() ?? 0} bytes)
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Pages</Text>
                  <Text style={styles.detailValue}>
                    {pageCountCache[selectedDetailsFile.uri] || selectedDetailsFile.pageCount || 1}{' '}
                    page(s)
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Modified Date</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(selectedDetailsFile.dateModified ?? selectedDetailsFile.date)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>URI / Path</Text>
                  <Text style={styles.detailValueMono} numberOfLines={4}>
                    {selectedDetailsFile.path ?? selectedDetailsFile.uri}
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.detailsActions}>
                <Pressable
                  style={styles.detailsOpenBtn}
                  onPress={() => {
                    const file = selectedDetailsFile;
                    setSelectedDetailsFile(null);
                    onOpenFile(file, 'edit');
                  }}
                >
                  <Text style={styles.detailsOpenBtnText}>✏️ Open in Editor</Text>
                </Pressable>
                <Pressable
                  style={styles.detailsShareBtn}
                  onPress={() => {
                    const file = selectedDetailsFile;
                    setSelectedDetailsFile(null);
                    void handleShareFile(file);
                  }}
                >
                  <Text style={styles.detailsShareBtnText}>📤 Share</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.xs + 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoHindi: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '900',
    marginTop: -2,
  },
  headerTextGroup: {
    gap: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerTitleHindi: {
    color: colors.brand,
  },
  headerSub: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rescanBtn: {
    backgroundColor: colors.brandWash,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.brandTint,
  },
  rescanBtnPressed: {
    backgroundColor: colors.brandTint,
  },
  rescanBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.brand,
  },
  pickPdfBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radius.full,
    ...shadows.soft,
  },
  pickPdfBtnPressed: {
    opacity: 0.85,
  },
  pickPdfBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  permissionIcon: {
    fontSize: 20,
  },
  permissionTextGroup: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400E',
  },
  permissionDesc: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 14,
  },
  permissionBtn: {
    backgroundColor: colors.brand,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: radius.full,
  },
  permissionBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    gap: spacing.xs,
    ...shadows.soft,
  },
  searchIcon: {
    fontSize: 14,
    opacity: 0.6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: colors.textPrimary,
    paddingVertical: 2,
  },
  clearSearchText: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: spacing.xs + 3,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    ...shadows.soft,
  },
  sortBtnPressed: {
    backgroundColor: colors.surfaceSubtle,
  },
  sortBtnIcon: {
    fontSize: 13,
  },
  sortBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs + 1,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 1,
  },
  tabItemActive: {
    borderBottomColor: colors.brand,
  },
  tabTextEn: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  tabTextHi: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  tabTextActive: {
    color: colors.brand,
    fontWeight: '800',
  },
  folderChipsScroll: {
    maxHeight: 36,
  },
  folderChipsContent: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 2,
    paddingVertical: 2,
    alignItems: 'center',
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  folderChipActive: {
    backgroundColor: colors.brandWash,
    borderColor: colors.brand,
  },
  folderChipIcon: {
    fontSize: 12,
  },
  folderChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  folderChipTextActive: {
    color: colors.brand,
    fontWeight: '800',
  },
  resultStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  resultStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    flex: 1,
  },
  sortIndicatorText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.brand,
  },
  listContent: {
    gap: spacing.xs + 3,
    paddingVertical: spacing.xs,
    paddingBottom: 85,
  },
  fileCard: {
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    ...shadows.soft,
  },
  fileCardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  fileCardPressed: {
    opacity: 0.8,
  },
  fileThumbnail: {
    width: 48,
    height: 60,
    borderRadius: radius.md,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: 3,
    gap: 2,
  },
  thumbPdfText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.brand,
    letterSpacing: 0.5,
  },
  thumbLines: {
    width: '100%',
    gap: 2,
    alignItems: 'center',
  },
  thumbLine: {
    width: '80%',
    height: 2,
    backgroundColor: 'rgba(21, 23, 44, 0.15)',
    borderRadius: 1,
  },
  thumbPageBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPageBadgeText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '800',
  },
  fileDetails: {
    flex: 1,
    gap: 3,
  },
  fileNameEn: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 18,
  },
  fileNameHi: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  fileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  recentPill: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  recentPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.brand,
  },
  folderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    gap: 3,
    maxWidth: 110,
  },
  folderPillIcon: {
    fontSize: 9.5,
  },
  folderPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  fileMetaDot: {
    fontSize: 9,
    color: colors.textTertiary,
  },
  fileMetaText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  cardActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: 4,
  },
  starBtn: {
    padding: 6,
  },
  starIcon: {
    fontSize: 18,
    color: colors.textTertiary,
  },
  starIconActive: {
    color: '#F59E0B',
  },
  moreBtn: {
    padding: 6,
  },
  moreBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  actionBtnPressed: {
    opacity: 0.6,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
    zIndex: 100,
  },
  fabPressed: {
    transform: [{ scale: 0.92 }],
  },
  fabIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '300',
    marginTop: -2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.xs + 2,
  },
  emptyIcon: {
    fontSize: 48,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 18,
  },
  emptyPickBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    marginTop: spacing.xs,
  },
  emptyPickBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyPickSecondaryBtn: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  },
  emptyPickSecondaryBtnText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    maxHeight: '85%',
    ...shadows.card,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  actionSheetThumb: {
    width: 38,
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetPdfBadge: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.brand,
  },
  actionSheetHeaderDetails: {
    flex: 1,
    gap: 2,
  },
  actionSheetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  actionSheetSub: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  actionSheetClose: {
    padding: 6,
  },
  actionSheetCloseText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  actionSheetMenu: {
    paddingTop: spacing.sm,
    gap: 4,
  },
  actionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  actionOptionIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  actionOptionTextGroup: {
    flex: 1,
    gap: 1,
  },
  actionOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  actionOptionDesc: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  sortModalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  sortModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sortModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sortOptionsList: {
    gap: 6,
  },
  sortItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: spacing.sm,
  },
  sortItemActive: {
    backgroundColor: colors.brandWash,
    borderColor: colors.brandTint,
  },
  sortItemIcon: {
    fontSize: 16,
  },
  sortItemTextGroup: {
    flex: 1,
    gap: 1,
  },
  sortItemLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sortItemLabelActive: {
    color: colors.brand,
  },
  sortItemHindi: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  sortItemCheck: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.brand,
  },
  detailsModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: radius['2xl'],
    margin: spacing.lg,
    padding: spacing.lg,
    maxHeight: '80%',
    alignSelf: 'center',
    width: '90%',
    gap: spacing.md,
    ...shadows.card,
  },
  detailsBody: {
    maxHeight: 320,
  },
  detailRow: {
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSubtle,
    gap: 2,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  detailValueMono: {
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#F8FAFC',
    padding: 4,
    borderRadius: 4,
  },
  detailsActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  detailsOpenBtn: {
    flex: 1,
    backgroundColor: colors.brand,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsOpenBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  detailsShareBtn: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsShareBtnText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});
