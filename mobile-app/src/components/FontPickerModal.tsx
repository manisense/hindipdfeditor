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

import { AppButton } from './AppButton';
import { DEVANAGARI_FONT_CATALOG, type DevanagariFontFamily } from '../lib/fontAsset';
import { colors, radius, spacing } from '../theme';

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
                    <ActivityIndicator color={colors.primary} />
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

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  cardContent: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textSecondary,
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
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  copy: {
    flex: 1,
  },
  fontName: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  description: {
    marginTop: 2,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  state: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  stateSelected: {
    color: colors.primaryDark,
  },
  actions: {
    alignItems: 'flex-end',
  },
});
