import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useAppPopup } from '../components/appPopupContext';
import { ScreenHeader } from '../components/ScreenHeader';
import { APP_VERSION } from '../constants/legal';
import { useSettingsStore, type AppLanguage, type AppTheme } from '../state/settingsStore';
import { colors, radius, shadows, spacing } from '../theme';

type LanguageOption = {
  id: AppLanguage;
  titleEn: string;
  titleHi: string;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: 'bilingual',
    titleEn: 'Bilingual',
    titleHi: 'द्विभाषी',
  },
  {
    id: 'english',
    titleEn: 'English',
    titleHi: 'अंग्रेज़ी',
  },
  {
    id: 'hindi',
    titleEn: 'Hindi',
    titleHi: 'हिंदी',
  },
];

type ThemeOption = {
  id: AppTheme;
  titleEn: string;
  titleHi: string;
  iconName: keyof typeof Ionicons.glyphMap;
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'light',
    titleEn: 'Light',
    titleHi: 'लाइट',
    iconName: 'sunny-outline',
  },
  {
    id: 'dark',
    titleEn: 'Dark',
    titleHi: 'डार्क',
    iconName: 'moon-outline',
  },
  {
    id: 'system',
    titleEn: 'System',
    titleHi: 'सिस्टम',
    iconName: 'phone-portrait-outline',
  },
];

/**
 * Compact, Non-Scrollable SettingsScreen adhering strictly to design-system.md:
 * - 3-Column Segmented Language selector (Bilingual, English, Hindi)
 * - 3-Column Theme selector (Light, Dark, System)
 * - Compact single-row Software Updates checker with popup feedback
 * - App Version & 100% offline footer
 */
export function SettingsScreen() {
  const {
    language,
    theme,
    isCheckingUpdate,
    updateStatus,
    loaded,
    initStore,
    setLanguage,
    setTheme,
    checkForUpdates,
  } = useSettingsStore();

  const { showPopup } = useAppPopup();

  useEffect(() => {
    if (!loaded) {
      void initStore();
    }
  }, [loaded, initStore]);

  const handleCheckUpdates = async () => {
    const res = await checkForUpdates();
    if (res.isLatest) {
      void showPopup({
        title: 'App is Up to Date / नवीनतम संस्करण',
        message: `You are running the latest version of Hindi PDF Editor (v${APP_VERSION}). All offline engines and fonts are up to date.`,
        tone: 'success',
        actionLabel: 'OK / ठीक है',
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Fixed Header (Never Scrolls) */}
      <ScreenHeader title="Settings /" titleAccent="सेटिंग्स" />

      {/* High-Density Compact Settings Area */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Card 1: 3-Column Segmented Language Selector */}
        <View style={styles.compactCard}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.compactIconChip, { backgroundColor: colors.accentBlueTint }]}>
              <MaterialCommunityIcons name="translate" size={17} color={colors.accentBlue} />
            </View>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.compactTitleEn}>App Language</Text>
              <Text style={styles.compactTitleHi}>भाषा चयन</Text>
            </View>
          </View>

          <View style={styles.segmentedRow}>
            {LANGUAGE_OPTIONS.map((opt) => {
              const isSelected = language === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => void setLanguage(opt.id)}
                  style={({ pressed }) => [
                    styles.segmentTile,
                    isSelected && styles.segmentTileSelected,
                    pressed && styles.tilePressed,
                  ]}
                >
                  <Text style={[styles.segmentLabelEn, isSelected && styles.textBrandActive]}>
                    {opt.titleEn}
                  </Text>
                  <Text style={[styles.segmentLabelHi, isSelected && styles.textBrandActive]}>
                    {opt.titleHi}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Card 2: 3-Column Theme Selector */}
        <View style={styles.compactCard}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.compactIconChip, { backgroundColor: colors.accentPurpleTint }]}>
              <MaterialCommunityIcons
                name="theme-light-dark"
                size={17}
                color={colors.accentPurple}
              />
            </View>
            <View style={styles.cardTitleGroup}>
              <Text style={styles.compactTitleEn}>Theme & Appearance</Text>
              <Text style={styles.compactTitleHi}>थीम</Text>
            </View>
          </View>

          <View style={styles.segmentedRow}>
            {THEME_OPTIONS.map((opt) => {
              const isSelected = theme === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => void setTheme(opt.id)}
                  style={({ pressed }) => [
                    styles.themeSegmentTile,
                    isSelected && styles.segmentTileSelected,
                    pressed && styles.tilePressed,
                  ]}
                >
                  <Ionicons
                    name={opt.iconName}
                    size={16}
                    color={isSelected ? colors.brand : colors.textSecondary}
                  />
                  <View style={styles.themeLabelColumn}>
                    <Text style={[styles.segmentLabelEn, isSelected && styles.textBrandActive]}>
                      {opt.titleEn}
                    </Text>
                    <Text style={[styles.segmentLabelHi, isSelected && styles.textBrandActive]}>
                      {opt.titleHi}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Card 3: Compact Single-Row Software Updates */}
        <View style={styles.compactCard}>
          <View style={styles.updateCardRow}>
            <View style={styles.updateLeftGroup}>
              <View style={[styles.compactIconChip, { backgroundColor: colors.accentTealTint }]}>
                <MaterialCommunityIcons
                  name="cloud-sync-outline"
                  size={17}
                  color={colors.accentTeal}
                />
              </View>
              <View style={styles.updateTextColumn}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.compactTitleEn}>Software Updates</Text>
                  <Text style={styles.compactTitleHi}>अपडेट</Text>
                </View>
                <View style={styles.updateStatusSubRow}>
                  {updateStatus === 'latest' && (
                    <Ionicons name="checkmark-circle" size={13} color={colors.accentGreen} />
                  )}
                  <Text style={styles.updateVersionBadge}>v{APP_VERSION} (Latest)</Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Check for updates"
              onPress={() => void handleCheckUpdates()}
              disabled={isCheckingUpdate}
              style={({ pressed }) => [
                styles.compactCheckButton,
                isCheckingUpdate && styles.compactCheckButtonDisabled,
                pressed && !isCheckingUpdate && styles.tilePressed,
              ]}
            >
              {isCheckingUpdate ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.compactCheckButtonText}>Check / जांचें</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Bottom App Version Footer */}
        <View style={styles.compactFooter}>
          <View style={styles.compactFooterBadge}>
            <Ionicons name="shield-checkmark" size={12} color={colors.accentGreen} />
            <Text style={styles.compactFooterBadgeText}>100% Offline & On-Device</Text>
          </View>
          <Text style={styles.compactFooterVersionText}>
            Hindi PDF Editor • v{APP_VERSION} (Build 1)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.xs,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    gap: spacing.sm + 2,
    paddingBottom: 24,
  },
  compactCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm + 3,
    gap: spacing.sm,
    ...shadows.soft,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactIconChip: {
    width: 32,
    height: 32,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  compactTitleEn: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  compactTitleHi: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brand,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segmentTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
  },
  themeSegmentTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: 9,
    paddingHorizontal: 4,
    gap: 6,
  },
  themeLabelColumn: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  segmentTileSelected: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brand,
  },
  tilePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  segmentLabelEn: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  segmentLabelHi: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  textBrandActive: {
    color: colors.brand,
    fontWeight: '800',
  },
  updateCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  updateLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  updateTextColumn: {
    flex: 1,
    gap: 2,
  },
  updateStatusSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  updateVersionBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  compactCheckButton: {
    backgroundColor: colors.brand,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
    minHeight: 34,
    ...shadows.brand,
  },
  compactCheckButtonDisabled: {
    opacity: 0.7,
  },
  compactCheckButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  compactFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: spacing.xs,
  },
  compactFooterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGreenTint,
    paddingVertical: 3,
    paddingHorizontal: 9,
    borderRadius: radius.full,
    gap: 4,
  },
  compactFooterBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.accentGreen,
  },
  compactFooterVersionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
  },
});
