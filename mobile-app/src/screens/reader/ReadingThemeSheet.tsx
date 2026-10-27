import { View } from 'react-native';

import { useTx } from '../../i18n';
import { BottomSheet } from '../../ui/BottomSheet';
import { SegmentedControl } from '../../ui/SegmentedControl';
import type { UiTokens } from '../../ui/tokens';

export type ReadingTheme = 'light' | 'sepia' | 'dark';

/**
 * Reader colours per reading theme: the backdrop between pages and an optional wash laid over
 * each page image (the image itself is never re-rendered). `backdrop: null` uses the app's
 * `ui.readingBackdrop`, so Day follows the app's light or dark mode.
 */
export const THEMES: Record<ReadingTheme, { backdrop: string | null; pageWash?: string }> = {
  light: { backdrop: null },
  sepia: { backdrop: '#E8DCCF', pageWash: 'rgba(240, 222, 186, 0.30)' },
  dark: { backdrop: '#0E1017', pageWash: 'rgba(14, 16, 23, 0.35)' },
};

/** Backdrop colour behind the pages for `theme`. */
export function readingBackdrop(theme: ReadingTheme, ui: UiTokens): string {
  return THEMES[theme].backdrop ?? ui.readingBackdrop;
}

/** Bottom sheet with a Day / Sepia / Night switch for the Reader. */
export function ReadingThemeSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: ReadingTheme;
  onChange: (theme: ReadingTheme) => void;
  onClose: () => void;
}) {
  const tx = useTx();
  const title = tx('Reading theme', 'पढ़ने की थीम');
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
        <SegmentedControl<ReadingTheme>
          label={title}
          value={value}
          onChange={onChange}
          options={[
            { value: 'light', label: tx('Day', 'दिन') },
            { value: 'sepia', label: tx('Sepia', 'सेपिया') },
            { value: 'dark', label: tx('Night', 'रात') },
          ]}
        />
      </View>
    </BottomSheet>
  );
}
