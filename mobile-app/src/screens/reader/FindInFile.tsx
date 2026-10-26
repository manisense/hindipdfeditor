import { FlatList, Pressable, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../../hooks/useAppTheme';
import { useTx } from '../../i18n';
import type { TextMatch } from '../../lib/textSearch';
import { Icon, type IconName } from '../../ui/Icon';
import { uiFont } from '../../ui/tokens';
import { UiText } from '../../ui/UiText';

/** Results panel height above the bottom inset, in dp. */
export const FIND_PANEL_HEIGHT = 330;
/** Characters of context kept before a match in a result row. */
const BEFORE_CHARS = 24;

/**
 * Find bar that replaces the Reader bar: a close button, an autofocused search field and a
 * clear button, on the dark chrome. 72dp plus the top inset, like `ReaderBar`.
 */
export function FindBar({
  query,
  onChangeQuery,
  onClose,
}: {
  query: string;
  onChangeQuery: (query: string) => void;
  onClose: () => void;
}) {
  const ui = useUi();
  const tx = useTx();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: ui.chrome,
        paddingTop: insets.top,
        height: 72 + insets.top,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        gap: 4,
      }}
    >
      <StatusBar style="light" />
      <BarButton icon="close" label={tx('Close search', 'खोज बंद करें')} onPress={onClose} />
      <TextInput
        autoFocus
        accessibilityLabel={tx('Find in file', 'फ़ाइल में खोजें')}
        placeholder={tx('Find in file', 'फ़ाइल में खोजें')}
        placeholderTextColor="rgba(255,255,255,0.6)"
        value={query}
        onChangeText={onChangeQuery}
        returnKeyType="search"
        autoCorrect={false}
        selectionColor="#A9BBFF"
        style={{
          flex: 1,
          height: 48,
          color: '#FFFFFF',
          fontSize: 17,
          fontFamily: uiFont.devanagari,
        }}
      />
      {query ? (
        <BarButton icon="clear" label={tx('Clear', 'मिटाएँ')} onPress={() => onChangeQuery('')} />
      ) : null}
    </View>
  );
}

function BarButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 24 }}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={24} color="#FFFFFF" />
    </Pressable>
  );
}

/**
 * Docked results panel, `FIND_PANEL_HEIGHT` dp above the bottom inset. It is not a modal, so the
 * search field and the pages stay usable. The header shows reading progress until every page is
 * read (`done` of `pageCount`), then the match count, with previous / next buttons. Each row
 * shows the page number and the line with the match in brand colour; tapping it calls `onPick`
 * with the row's index in `matches`.
 */
export function FindPanel({
  query,
  matches,
  currentIndex,
  done,
  pageCount,
  failedPages,
  onPick,
}: {
  query: string;
  matches: TextMatch[];
  currentIndex: number;
  done: number;
  pageCount: number;
  failedPages: number;
  onPick: (index: number) => void;
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const tx = useTx();
  const insets = useSafeAreaInsets();

  const reading = done < pageCount;
  const hasQuery = query.trim().length > 0;
  const count = matches.length;
  const step = Math.min(done + 1, pageCount);
  const header = reading
    ? tx(
        'Searching page ' + step + ' of ' + pageCount,
        'पृष्ठ ' + step + ' / ' + pageCount + ' में खोज रहे हैं',
      )
    : hasQuery
      ? tx(count + ' matches', count + ' परिणाम')
      : tx('Type a word to find', 'खोजने के लिए शब्द लिखें');
  const canStep = count > 0;

  return (
    <View
      style={{
        height: FIND_PANEL_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        elevation: 8,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 24,
          paddingRight: 12,
          paddingTop: 12,
          paddingBottom: 4,
          gap: 4,
        }}
      >
        <UiText
          variant="label"
          color={ui.inkSecondary}
          accessibilityLiveRegion="polite"
          style={{ flex: 1 }}
        >
          {header}
        </UiText>
        <StepButton
          icon="keyboard-arrow-up"
          label={tx('Previous match', 'पिछला परिणाम')}
          disabled={!canStep}
          onPress={() => onPick((currentIndex - 1 + count) % count)}
        />
        <StepButton
          icon="keyboard-arrow-down"
          label={tx('Next match', 'अगला परिणाम')}
          disabled={!canStep}
          onPress={() => onPick((currentIndex + 1) % count)}
        />
      </View>
      {failedPages > 0 ? (
        <UiText variant="meta" color={ui.danger} style={{ paddingHorizontal: 24 }}>
          {tx("Couldn't read " + failedPages + ' pages', failedPages + ' पृष्ठ नहीं पढ़े जा सके')}
        </UiText>
      ) : null}
      {hasQuery && !reading && count === 0 ? (
        <UiText
          variant="body"
          color={ui.inkTertiary}
          style={{ textAlign: 'center', marginTop: 48 }}
        >
          {tx('No matches', 'कोई परिणाम नहीं')}
        </UiText>
      ) : (
        <FlatList
          data={hasQuery ? matches : []}
          keyExtractor={(m, i) => `${m.pageIndex}-${m.lineIndex}-${i}`}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => (
            <ResultRow
              match={item}
              selected={index === currentIndex}
              onPress={() => onPick(index)}
            />
          )}
        />
      )}
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const ui = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={2}
      android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: true, radius: 22 }}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={24} color={disabled ? ui.inkTertiary : ui.inkLabel} />
    </Pressable>
  );
}

function ResultRow({
  match,
  selected,
  onPress,
}: {
  match: TextMatch;
  selected: boolean;
  onPress: () => void;
}) {
  const ui = useUi();
  const tx = useTx();
  const page = match.pageIndex + 1;
  const before =
    match.before.length > BEFORE_CHARS ? '…' + match.before.slice(-BEFORE_CHARS) : match.before;
  const line = match.before + match.match + match.after;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tx('Page ' + page + ': ' + line, 'पृष्ठ ' + page + ': ' + line)}
      accessibilityState={{ selected }}
      onPress={onPress}
      android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: false }}
      style={{
        minHeight: 48,
        paddingHorizontal: 24,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: selected ? ui.brandTint : undefined,
      }}
    >
      <UiText variant="label" color={ui.inkTertiary} style={{ minWidth: 40 }}>
        {tx('p. ' + page, 'पृ. ' + page)}
      </UiText>
      <UiText numberOfLines={1} style={{ flex: 1, fontSize: 15, fontFamily: uiFont.devanagari }}>
        {before}
        <UiText
          color={ui.brandOnSurface}
          style={{ fontSize: 15, fontWeight: '600', fontFamily: uiFont.devanagari }}
        >
          {match.match}
        </UiText>
        {match.after}
      </UiText>
    </Pressable>
  );
}
