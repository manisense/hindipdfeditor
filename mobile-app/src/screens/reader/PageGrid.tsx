import { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../../hooks/useAppTheme';
import { useTx } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { PillButton } from '../../ui/PillButton';
import { ReaderBar } from '../../ui/ReaderBar';
import { UiText } from '../../ui/UiText';

const COLUMNS = 3;
/** Outer padding and gap between cells, in dp. */
const PADDING = 16;
const GAP = 12;
/** Page label height under each thumbnail, in dp. */
const LABEL_HEIGHT = 28;
/** Thumbnail width / height (A4 portrait); thumbnails are letterboxed into it. */
const THUMB_ASPECT = 1 / 1.414;
const VIEWABILITY = { itemVisiblePercentThreshold: 10 };

/**
 * Full-screen page picker: a dark bar with Close and "n pages", a 3-column thumbnail grid with
 * the current page outlined 3dp in brand blue, and a page-number box with Go. Pages are
 * zero-based in props and one-based on screen. `onVisiblePages` reports the pages on screen so
 * the caller can render their thumbnails. Android back closes it.
 */
export function PageGrid({
  visible,
  pageCount,
  currentPage,
  thumbUriFor,
  onPick,
  onClose,
  onVisiblePages,
}: {
  visible: boolean;
  pageCount: number;
  currentPage: number;
  thumbUriFor: (page: number) => string | undefined;
  onPick: (page: number) => void;
  onClose: () => void;
  onVisiblePages?: (pages: number[]) => void;
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const tx = useTx();
  const { width } = useWindowDimensions();
  const cellWidth = (width - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const thumbHeight = cellWidth / THUMB_ASPECT;
  const rowLength = thumbHeight + LABEL_HEIGHT + GAP;
  const pages = Array.from({ length: pageCount }, (_, i) => i);

  const handleViewable = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<number>[] }) => {
      if (!onVisiblePages) return;
      const visiblePages = viewableItems.map((token) => token.item);
      if (visiblePages.length === 0) return;
      // Also the next row, so thumbnails are ready before they scroll in.
      const last = Math.max(...visiblePages);
      for (let p = last + 1; p <= Math.min(last + COLUMNS, pageCount - 1); p++)
        visiblePages.push(p);
      onVisiblePages(visiblePages);
    },
    [onVisiblePages, pageCount],
  );

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1, backgroundColor: theme.colors.background }}
      >
        <ReaderBar
          title={tx(pageCount + ' pages', pageCount + ' पृष्ठ')}
          leadingIcon="close"
          onLeading={onClose}
        />
        <FlatList
          data={pages}
          numColumns={COLUMNS}
          keyExtractor={(page) => `grid-${page}`}
          initialScrollIndex={Math.floor(currentPage / COLUMNS)}
          getItemLayout={(_data, row) => ({
            length: rowLength,
            offset: PADDING + rowLength * row,
            index: row,
          })}
          onViewableItemsChanged={handleViewable}
          viewabilityConfig={VIEWABILITY}
          contentContainerStyle={{ padding: PADDING }}
          columnWrapperStyle={{ gap: GAP }}
          renderItem={({ item: page }) => {
            const current = page === currentPage;
            const uri = thumbUriFor(page);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tx(`Page ${page + 1}`, `पृष्ठ ${page + 1}`)}
                accessibilityState={{ selected: current }}
                onPress={() => onPick(page)}
                style={{ width: cellWidth, height: thumbHeight + LABEL_HEIGHT, marginBottom: GAP }}
              >
                <View
                  style={{
                    width: cellWidth,
                    height: thumbHeight,
                    borderRadius: 4,
                    borderWidth: current ? 3 : 1,
                    borderColor: current ? ui.brand : ui.ring,
                    backgroundColor: '#FFFFFF',
                    overflow: 'hidden',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {uri ? (
                    <Image
                      source={{ uri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Icon name="description" size={24} color={ui.inkTertiary} />
                  )}
                </View>
                <UiText
                  variant="label"
                  color={current ? ui.brandOnSurface : ui.inkSecondary}
                  style={{ textAlign: 'center', lineHeight: LABEL_HEIGHT }}
                >
                  {page + 1}
                </UiText>
              </Pressable>
            );
          }}
        />
        <GoToPageRow pageCount={pageCount} onGo={onPick} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Page-number box with Go under the grid. `onGo` gets a zero-based page; an out-of-range number
 * shows an inline error instead. Its state starts fresh each time the grid opens.
 */
function GoToPageRow({ pageCount, onGo }: { pageCount: number; onGo: (page: number) => void }) {
  const ui = useUi();
  const theme = useAppTheme();
  const tx = useTx();
  const insets = useSafeAreaInsets();
  const [pageInput, setPageInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const go = () => {
    const page = parseInt(pageInput.trim(), 10);
    if (Number.isNaN(page) || page < 1 || page > pageCount) {
      setError(tx('Enter a page from 1 to ' + pageCount, '1 से ' + pageCount + ' तक पृष्ठ लिखें'));
      return;
    }
    onGo(page - 1);
  };

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: ui.divider,
        paddingTop: 12,
        paddingHorizontal: 16,
        paddingBottom: 12 + insets.bottom,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TextInput
          accessibilityLabel={tx('Page number', 'पृष्ठ संख्या')}
          placeholder={tx('Page number', 'पृष्ठ संख्या')}
          placeholderTextColor={ui.inkTertiary}
          value={pageInput}
          onChangeText={(text) => {
            setPageInput(text);
            setError(null);
          }}
          onSubmitEditing={go}
          keyboardType="number-pad"
          returnKeyType="go"
          maxLength={5}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 9999,
            paddingHorizontal: 20,
            backgroundColor: ui.fill,
            color: ui.ink,
            fontSize: 16,
          }}
        />
        <PillButton title={tx('Go', 'जाएँ')} onPress={go} />
      </View>
      {error ? (
        <UiText
          variant="meta"
          color={ui.danger}
          accessibilityLiveRegion="polite"
          style={{ paddingHorizontal: 20 }}
        >
          {error}
        </UiText>
      ) : null}
    </View>
  );
}
