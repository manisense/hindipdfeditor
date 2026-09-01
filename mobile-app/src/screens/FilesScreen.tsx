import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import type { ToolId } from '../components/ToolShell';
import { useThemedStyles } from '../hooks/useAppTheme';
import {
  getPageCount,
  hasStoragePermission,
  renderPage,
  requestStoragePermission,
  scanDevicePdfFiles,
} from '../lib/pdfToImages';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { useSettingsStore } from '../state/settingsStore';
import { type Theme, colors, radius, shadows, spacing } from '../theme';

type Props = {
  onOpenFile: (file: RecentFile, toolId?: ToolId) => void;
  onOpenTool?: (tool: ToolId | null) => void;
};

type FileCategoryTab = 'all' | 'downloads' | 'whatsapp' | 'documents' | 'starred';

type SortOption = 'date_desc' | 'date_asc' | 'name_asc' | 'name_desc' | 'size_desc' | 'size_asc';

const SORT_LABELS: Record<
  SortOption,
  { label: string; hindi: string; iconName: keyof typeof Ionicons.glyphMap }
> = {
  date_desc: { label: 'Newest First', hindi: 'नवीनतम पहले', iconName: 'time-outline' },
  date_asc: { label: 'Oldest First', hindi: 'पुराने पहले', iconName: 'time' },
  name_asc: { label: 'Name (A to Z)', hindi: 'नाम (A-Z)', iconName: 'text' },
  name_desc: { label: 'Name (Z to A)', hindi: 'नाम (Z-A)', iconName: 'text-outline' },
  size_desc: { label: 'Largest Size', hindi: 'बड़ा साइज', iconName: 'trending-up-outline' },
  size_asc: { label: 'Smallest Size', hindi: 'छोटा साइज', iconName: 'trending-down-outline' },
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

function getFolderIconName(folderName?: string): keyof typeof Ionicons.glyphMap {
  if (!folderName) return 'folder-outline';
  const f = folderName.toLowerCase();
  if (f.includes('download')) return 'download-outline';
  if (f.includes('whatsapp') || f.includes('chat') || f.includes('telegram'))
    return 'chatbubbles-outline';
  if (f.includes('camscanner') || f.includes('scan') || f.includes('adobe'))
    return 'camera-outline';
  if (f.includes('document')) return 'document-text-outline';
  return 'folder-outline';
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

// In-memory module-level cache for scanned device files to avoid rescanning on every tab switch
let cachedScannedDeviceFiles: RecentFile[] | null = null;
let isScanRunning = false;

export function FilesScreen({ onOpenFile }: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(getStyles);
  const [activeCategory, setActiveCategory] = useState<FileCategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [showSortModal, setShowSortModal] = useState(false);
  const [selectedDetailsFile, setSelectedDetailsFile] = useState<RecentFile | null>(null);
  const [activeMenuFile, setActiveMenuFile] = useState<RecentFile | null>(null);

  const [deviceFiles, setDeviceFiles] = useState<RecentFile[]>(cachedScannedDeviceFiles ?? []);
  const [scanning, setScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // In-memory thumbnail and pageCount cache
  const [thumbnailCache, setThumbnailCache] = useState<Record<string, string>>({});
  const [pageCountCache, setPageCountCache] = useState<Record<string, number>>({});
  const renderingRefs = useRef<Set<string>>(new Set());

  const language = useSettingsStore((s) => s.language);
  const files = useRecentFilesStore((state) => state.files);
  const addFile = useRecentFilesStore((state) => state.addFile);
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
        const dateStr = item.dateModified
          ? new Date(item.dateModified).toLocaleDateString('en-IN', {
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
          dateModified: item.dateModified,
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

  // Combine recent files store + scanned device storage files, removing duplicates by URI
  const mergedFiles: RecentFile[] = useMemo(() => {
    const recentMap = new Map<string, RecentFile>();
    for (const f of files) {
      recentMap.set(f.uri, { ...f, isRecent: true });
    }

    const otherDeviceList: RecentFile[] = [];
    for (const f of deviceFiles) {
      if (!recentMap.has(f.uri)) {
        otherDeviceList.push(f);
      }
    }

    const recentList = Array.from(recentMap.values());

    // Recent files always at top, followed by all device files
    return [...recentList, ...otherDeviceList];
  }, [files, deviceFiles]);

  // Filter files by category and search query
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
  }, [mergedFiles, activeCategory, searchQuery]);

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
                <Ionicons name="document-text" size={22} color={colors.brand} />
              </View>
            )}
          </View>

          {/* Clean Details */}
          <View style={styles.fileDetails}>
            <Text style={styles.fileNameEn} numberOfLines={1}>
              {file.name}
            </Text>
            <View style={styles.fileMetaRow}>
              {file.starred && <Ionicons name="star" size={11} color="#F59E0B" />}
              <Text style={styles.fileMetaText}>
                {pageCount > 0 ? `${pageCount} pg • ` : ''}
                {formatFileSize(file.sizeBytes)} • {file.date}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Right Side Quick Actions: More Menu */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="File actions"
          onPress={() => setActiveMenuFile(file)}
          style={({ pressed }) => [styles.moreBtn, pressed && styles.actionBtnPressed]}
          hitSlop={10}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      {language === 'hindi' ? (
        <ScreenHeader title="फाइलें" />
      ) : language === 'english' ? (
        <ScreenHeader title="Files" />
      ) : (
        <ScreenHeader title="Files /" titleAccent="फाइलें" />
      )}

      {/* Permission Request Alert Card if denied */}
      {hasPermission === false && (
        <View style={styles.permissionCard}>
          <Ionicons name="warning-outline" size={24} color={colors.warning} />
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
          <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
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
              <Ionicons name="close-circle" size={16} color={colors.textTertiary} />
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
          <Ionicons name={SORT_LABELS[sortBy].iconName} size={15} color={colors.brand} />
          <Text style={styles.sortBtnText}>Sort</Text>
        </Pressable>
      </View>

      {/* Primary Category Filter Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeCategory === 'all' }}
          onPress={() => setActiveCategory('all')}
          style={[styles.tabItem, activeCategory === 'all' && styles.tabItemActive]}
        >
          {(language === 'bilingual' || language === 'english') && (
            <Text style={[styles.tabTextEn, activeCategory === 'all' && styles.tabTextActive]}>
              All ({mergedFiles.length})
            </Text>
          )}
          {(language === 'bilingual' || language === 'hindi') && (
            <Text style={[styles.tabTextHi, activeCategory === 'all' && styles.tabTextActive]}>
              सभी PDF
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeCategory === 'downloads' }}
          onPress={() => setActiveCategory('downloads')}
          style={[styles.tabItem, activeCategory === 'downloads' && styles.tabItemActive]}
        >
          {(language === 'bilingual' || language === 'english') && (
            <Text
              style={[styles.tabTextEn, activeCategory === 'downloads' && styles.tabTextActive]}
            >
              Downloads
            </Text>
          )}
          {(language === 'bilingual' || language === 'hindi') && (
            <Text
              style={[styles.tabTextHi, activeCategory === 'downloads' && styles.tabTextActive]}
            >
              डाउनलोड
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeCategory === 'whatsapp' }}
          onPress={() => setActiveCategory('whatsapp')}
          style={[styles.tabItem, activeCategory === 'whatsapp' && styles.tabItemActive]}
        >
          {(language === 'bilingual' || language === 'english') && (
            <Text style={[styles.tabTextEn, activeCategory === 'whatsapp' && styles.tabTextActive]}>
              WhatsApp
            </Text>
          )}
          {(language === 'bilingual' || language === 'hindi') && (
            <Text style={[styles.tabTextHi, activeCategory === 'whatsapp' && styles.tabTextActive]}>
              व्हाट्सएप
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeCategory === 'documents' }}
          onPress={() => setActiveCategory('documents')}
          style={[styles.tabItem, activeCategory === 'documents' && styles.tabItemActive]}
        >
          {(language === 'bilingual' || language === 'english') && (
            <Text
              style={[styles.tabTextEn, activeCategory === 'documents' && styles.tabTextActive]}
            >
              Documents
            </Text>
          )}
          {(language === 'bilingual' || language === 'hindi') && (
            <Text
              style={[styles.tabTextHi, activeCategory === 'documents' && styles.tabTextActive]}
            >
              दस्तावेज़
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeCategory === 'starred' }}
          onPress={() => setActiveCategory('starred')}
          style={[styles.tabItem, activeCategory === 'starred' && styles.tabItemActive]}
        >
          {(language === 'bilingual' || language === 'english') && (
            <Text style={[styles.tabTextEn, activeCategory === 'starred' && styles.tabTextActive]}>
              Starred
            </Text>
          )}
          {(language === 'bilingual' || language === 'hindi') && (
            <Text style={[styles.tabTextHi, activeCategory === 'starred' && styles.tabTextActive]}>
              पसंदीदा
            </Text>
          )}
        </Pressable>
      </View>

      {/* Virtualized FlatList for High Performance */}
      <FlatList
        data={sortedFiles}
        keyExtractor={(item) => item.id}
        renderItem={renderFileItem}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 110,
          },
        ]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        refreshControl={
          <RefreshControl
            refreshing={scanning}
            onRefresh={() => void scanFiles(true)}
            colors={[colors.brand]}
            tintColor={colors.brand}
          />
        }
        ListEmptyComponent={
          hasPermission === false ? (
            <View style={styles.emptyState}>
              <Ionicons name="lock-closed-outline" size={44} color={colors.brand} />
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
                <Text style={styles.emptyPickBtnText}>Grant Storage Permission / अनुमति दें</Text>
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
              <Ionicons name="folder-open-outline" size={44} color={colors.textTertiary} />
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

      {/* Action Menu Modal Sheet */}
      {activeMenuFile && (
        <Modal
          visible={Boolean(activeMenuFile)}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveMenuFile(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setActiveMenuFile(null)}>
            <View
              style={[
                styles.actionSheetContainer,
                {
                  paddingBottom:
                    Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + spacing.lg,
                },
              ]}
            >
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
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Action Options */}
              <View style={styles.actionSheetMenu}>
                <Pressable
                  style={({ pressed }) => [
                    styles.actionOption,
                    pressed && styles.actionOptionPressed,
                  ]}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'viewer');
                  }}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: colors.accentTealTint }]}>
                    <MaterialCommunityIcons
                      name="book-open-page-variant-outline"
                      size={18}
                      color={colors.accentTeal}
                    />
                  </View>
                  <Text style={styles.actionOptionTitle}>Read & View PDF (देखें और पढ़ें)</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionOption,
                    pressed && styles.actionOptionPressed,
                  ]}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'edit');
                  }}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: colors.accentBlueTint }]}>
                    <MaterialCommunityIcons
                      name="file-document-edit-outline"
                      size={18}
                      color={colors.accentBlue}
                    />
                  </View>
                  <Text style={styles.actionOptionTitle}>Edit Hindi Text (संपादित करें)</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionOption,
                    pressed && styles.actionOptionPressed,
                  ]}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'translate');
                  }}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: colors.accentGreenTint }]}>
                    <MaterialCommunityIcons name="translate" size={18} color={colors.accentGreen} />
                  </View>
                  <Text style={styles.actionOptionTitle}>Translate Document (अनुवाद)</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionOption,
                    pressed && styles.actionOptionPressed,
                  ]}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'compress');
                  }}
                >
                  <View
                    style={[styles.actionIconBox, { backgroundColor: colors.accentOrangeTint }]}
                  >
                    <MaterialCommunityIcons
                      name="archive-arrow-down-outline"
                      size={18}
                      color={colors.accentOrange}
                    />
                  </View>
                  <Text style={styles.actionOptionTitle}>Compress PDF (कंप्रेस करें)</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionOption,
                    pressed && styles.actionOptionPressed,
                  ]}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'split');
                  }}
                >
                  <View
                    style={[styles.actionIconBox, { backgroundColor: colors.accentPurpleTint }]}
                  >
                    <MaterialCommunityIcons
                      name="content-cut"
                      size={18}
                      color={colors.accentPurple}
                    />
                  </View>
                  <Text style={styles.actionOptionTitle}>Split Pages (विभाजित करें)</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionOption,
                    pressed && styles.actionOptionPressed,
                  ]}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    onOpenFile(file, 'merge');
                  }}
                >
                  <View
                    style={[styles.actionIconBox, { backgroundColor: colors.accentPurpleTint }]}
                  >
                    <MaterialCommunityIcons
                      name="layers-triple-outline"
                      size={18}
                      color={colors.accentPurple}
                    />
                  </View>
                  <Text style={styles.actionOptionTitle}>Merge PDFs (मर्ज करें)</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionOption,
                    pressed && styles.actionOptionPressed,
                  ]}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    void handleToggleStar(file);
                  }}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons
                      name={activeMenuFile.starred ? 'star' : 'star-outline'}
                      size={18}
                      color="#D97706"
                    />
                  </View>
                  <Text style={styles.actionOptionTitle}>
                    {activeMenuFile.starred ? 'Remove from Starred' : 'Add to Starred'}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionOption,
                    pressed && styles.actionOptionPressed,
                  ]}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    void handleShareFile(file);
                  }}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: colors.surfaceSubtle }]}>
                    <Ionicons name="share-outline" size={18} color={colors.textPrimary} />
                  </View>
                  <Text style={styles.actionOptionTitle}>Share PDF (शेयर करें)</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionOption,
                    pressed && styles.actionOptionPressed,
                  ]}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    setSelectedDetailsFile(file);
                  }}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: colors.surfaceSubtle }]}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color={colors.textPrimary}
                    />
                  </View>
                  <Text style={styles.actionOptionTitle}>File Details & Info</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.actionOption,
                    pressed && styles.actionOptionPressed,
                  ]}
                  onPress={() => {
                    const file = activeMenuFile;
                    setActiveMenuFile(null);
                    void removeFile(file.id);
                  }}
                >
                  <View style={[styles.actionIconBox, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </View>
                  <Text style={[styles.actionOptionTitle, { color: colors.danger }]}>
                    Remove from List (हटाएं)
                  </Text>
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
          <View
            style={[
              styles.sortModalCard,
              {
                paddingBottom:
                  Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + spacing.lg,
              },
            ]}
          >
            <View style={styles.sortModalHeader}>
              <Text style={styles.sortModalTitle}>Sort Documents / क्रमबद्ध करें</Text>
              <Pressable onPress={() => setShowSortModal(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
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
                    <Ionicons
                      name={opt.iconName}
                      size={18}
                      color={isSelected ? colors.brand : colors.textSecondary}
                    />
                    <View style={styles.sortItemTextGroup}>
                      <Text
                        style={[styles.sortItemLabel, isSelected && styles.sortItemLabelActive]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.sortItemHindi}>{opt.hindi}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={18} color={colors.brand} />}
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
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons
                      name={getFolderIconName(selectedDetailsFile.folder)}
                      size={14}
                      color={colors.brand}
                    />
                    <Text style={styles.detailValue}>
                      {selectedDetailsFile.folder ?? 'Device Storage'}
                    </Text>
                  </View>
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="pencil" size={14} color="#ffffff" />
                    <Text style={styles.detailsOpenBtnText}>Open in Editor</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={styles.detailsShareBtn}
                  onPress={() => {
                    const file = selectedDetailsFile;
                    setSelectedDetailsFile(null);
                    void handleShareFile(file);
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="share-outline" size={14} color={colors.textPrimary} />
                    <Text style={styles.detailsShareBtnText}>Share</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      gap: spacing.xs,
      backgroundColor: theme.colors.background,
    },
    permissionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.warningSoft,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.warning,
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
      color: theme.colors.warning,
    },
    permissionDesc: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      lineHeight: 14,
    },
    permissionBtn: {
      backgroundColor: theme.colors.brand,
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
      backgroundColor: theme.colors.surface,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
      color: theme.colors.textPrimary,
      paddingVertical: 2,
    },
    clearSearchText: {
      fontSize: 13,
      color: theme.colors.textTertiary,
      fontWeight: '700',
      paddingHorizontal: 4,
    },
    sortBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      paddingVertical: spacing.xs + 3,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      gap: 4,
      ...shadows.soft,
    },
    sortBtnPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
    },
    sortBtnIcon: {
      fontSize: 13,
    },
    sortBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: theme.colors.textPrimary,
    },
    tabRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
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
      borderBottomColor: theme.colors.brand,
    },
    tabTextEn: {
      fontSize: 11.5,
      fontWeight: '700',
      color: theme.colors.textTertiary,
    },
    tabTextHi: {
      fontSize: 10,
      fontWeight: '600',
      color: theme.colors.textTertiary,
    },
    tabTextActive: {
      color: theme.colors.brand,
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
      color: theme.colors.textTertiary,
      flex: 1,
    },
    sortIndicatorText: {
      fontSize: 10.5,
      fontWeight: '700',
      color: theme.colors.brand,
    },
    listContent: {
      gap: spacing.xs + 3,
      paddingVertical: spacing.xs,
      paddingBottom: 85,
    },
    fileCard: {
      position: 'relative',
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
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
      width: 44,
      height: 52,
      borderRadius: radius.chip,
      backgroundColor: theme.colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbImage: {
      width: '100%',
      height: '100%',
    },
    thumbPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    },
    fileDetails: {
      flex: 1,
      justifyContent: 'center',
      gap: 3,
    },
    fileNameEn: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      lineHeight: 18,
    },
    fileMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    fileMetaText: {
      fontSize: 11.5,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    moreBtn: {
      padding: 8,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionBtnPressed: {
      opacity: 0.6,
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
      color: theme.colors.textPrimary,
    },
    emptySubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      maxWidth: 260,
      lineHeight: 18,
    },
    emptyPickBtn: {
      backgroundColor: theme.colors.brand,
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
      backgroundColor: theme.colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: 6,
    },
    emptyPickSecondaryBtnText: {
      color: theme.colors.textPrimary,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'flex-end',
    },
    actionSheetContainer: {
      backgroundColor: theme.colors.surface,
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
      borderBottomColor: theme.colors.border,
      gap: spacing.sm,
    },
    actionSheetThumb: {
      width: 38,
      height: 48,
      borderRadius: radius.sm,
      backgroundColor: theme.colors.brandWash,
      borderWidth: 1,
      borderColor: theme.colors.brandTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionSheetPdfBadge: {
      fontSize: 10,
      fontWeight: '900',
      color: theme.colors.brand,
    },
    actionSheetHeaderDetails: {
      flex: 1,
      gap: 2,
    },
    actionSheetTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    actionSheetSub: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    actionSheetClose: {
      padding: 6,
    },
    actionSheetCloseText: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.textTertiary,
    },
    actionSheetMenu: {
      paddingTop: spacing.sm,
      gap: 4,
    },
    actionOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 9,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.md,
      gap: spacing.sm + 2,
    },
    actionOptionPressed: {
      backgroundColor: theme.colors.surfaceSubtle,
      transform: [{ scale: 0.98 }],
    },
    actionIconBox: {
      width: 32,
      height: 32,
      borderRadius: radius.chip,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionOptionTitle: {
      fontSize: 13.5,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      flex: 1,
    },
    sortModalCard: {
      backgroundColor: theme.colors.surface,
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
      borderBottomColor: theme.colors.border,
    },
    sortModalTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.colors.textPrimary,
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
      backgroundColor: theme.colors.brandWash,
      borderColor: theme.colors.brandTint,
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
      color: theme.colors.textPrimary,
    },
    sortItemLabelActive: {
      color: theme.colors.brand,
    },
    sortItemHindi: {
      fontSize: 11,
      color: theme.colors.textTertiary,
    },
    sortItemCheck: {
      fontSize: 16,
      fontWeight: '900',
      color: theme.colors.brand,
    },
    detailsModalCard: {
      backgroundColor: theme.colors.surface,
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
      borderBottomColor: theme.colors.surfaceSubtle,
      gap: 2,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.textTertiary,
      textTransform: 'uppercase',
    },
    detailValue: {
      fontSize: 13.5,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    detailValueMono: {
      fontSize: 11,
      color: theme.colors.textSecondary,
      fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
      backgroundColor: theme.colors.surfaceSubtle,
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
      backgroundColor: theme.colors.brand,
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
      backgroundColor: theme.colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailsShareBtnText: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: '700',
    },
  });
