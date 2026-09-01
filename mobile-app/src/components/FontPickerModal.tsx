import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useThemedStyles, useAppTheme } from '../hooks/useAppTheme';
import { DEVANAGARI_FONT_CATALOG, type DevanagariFontFamily } from '../lib/fontAsset';
import { type Theme, radius, shadows, spacing } from '../theme';
import { AppButton } from './AppButton';

type Props = {
  visible: boolean;
  selectedFamily: DevanagariFontFamily;
  loadedFamilies: ReadonlySet<DevanagariFontFamily>;
  downloadingFamily: DevanagariFontFamily | null;
  onChoose: (family: DevanagariFontFamily) => void;
  onClose: () => void;
};

/** Curated Unicode-only font installer/selector; legacy-encoded font files are never offered. */
export function FontPickerModal({
  visible,
  selectedFamily,
  loadedFamilies,
  downloadingFamily,
  onChoose,
  onClose,
}: Props) {
  const { height } = useWindowDimensions();
  const theme = useAppTheme();
  const styles = useThemedStyles(getStyles);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView
          style={[styles.card, { maxHeight: Math.max(280, height - spacing.xl * 2) }]}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
          accessibilityViewIsModal
        >
          <Text style={styles.title}>Choose a Unicode Hindi font</Text>
          <Text style={styles.body}>
            Downloaded fonts come from a pinned, official Google Fonts file and are embedded in the
            exported PDF. Legacy KrutiDev-style fonts are not offered because they do not convert
            Latin-mapped text into Unicode.
          </Text>

          <View style={styles.list}>
            {DEVANAGARI_FONT_CATALOG.map((font) => {
              const loaded = loadedFamilies.has(font.family);
              const downloading = downloadingFamily === font.family;
              const selected = selectedFamily === font.family;
              return (
                <Pressable
                  key={font.family}
                  accessibilityRole="button"
                  accessibilityLabel={`${font.label}. ${loaded ? 'Installed' : 'Download font'}`}
                  accessibilityState={{ selected, disabled: downloadingFamily !== null }}
                  disabled={downloadingFamily !== null}
                  onPress={() => onChoose(font.family)}
                  style={[styles.row, selected && styles.rowSelected]}
                >
                  <View style={styles.copy}>
                    <Text style={[styles.fontName, loaded && { fontFamily: font.family }]}>
                      {font.label} · हिंदी
                    </Text>
                    <Text style={styles.description}>{font.description}</Text>
                  </View>
                  {downloading ? (
                    <ActivityIndicator color={theme.colors.brand} />
                  ) : (
                    <Text style={[styles.state, selected && styles.stateSelected]}>
                      {selected ? 'Selected' : loaded ? 'Use' : 'Download'}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <AppButton title="Close" small variant="ghost" onPress={onClose} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      padding: spacing.xl,
      backgroundColor: 'rgba(20, 22, 31, 0.65)',
    },
    card: {
      borderRadius: radius.card,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...shadows.popup,
    },
    cardContent: {
      padding: spacing.xl,
      gap: spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    body: {
      fontSize: 12.5,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
    list: {
      gap: spacing.sm,
    },
    row: {
      minHeight: 68,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: radius.chip,
    },
    rowSelected: {
      borderColor: theme.colors.brand,
      backgroundColor: theme.colors.brandTint,
    },
    copy: {
      flex: 1,
    },
    fontName: {
      fontSize: 16,
      color: theme.colors.textPrimary,
    },
    description: {
      marginTop: 2,
      fontSize: 11.5,
      color: theme.colors.textSecondary,
    },
    state: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.colors.brand,
    },
    stateSelected: {
      color: theme.colors.brandDeep,
    },
    actions: {
      alignItems: 'flex-end',
    },
  });
