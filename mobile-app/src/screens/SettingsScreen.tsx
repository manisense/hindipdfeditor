import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { AppButton } from '../components/AppButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { APP_VERSION } from '../constants/legal';
import { useSettingsStore, type AppLanguage, type AppTheme } from '../state/settingsStore';
import { colors, radius, shadows, spacing } from '../theme';

type LanguageOption = {
  id: AppLanguage;
  titleEn: string;
  titleHi: string;
  desc: string;
};

const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    id: 'bilingual',
    titleEn: 'Bilingual (English + हिंदी)',
    titleHi: 'द्विभाषी (English + हिंदी)',
    desc: 'Displays both English and Devanagari side by side (Recommended)',
  },
  {
    id: 'english',
    titleEn: 'English Only',
    titleHi: 'केवल अंग्रेज़ी',
    desc: 'Primary English interface with Latin typography',
  },
  {
    id: 'hindi',
    titleEn: 'हिंदी केवल (Hindi Only)',
    titleHi: 'केवल हिंदी',
    desc: 'पूर्ण रूप से देवनागरी इंटरफ़ेस और टूल्स',
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
 * SettingsScreen adhering strictly to design-system.md:
 * - Language selector (Bilingual, English, Hindi)
 * - Theme selector (Light, Dark, System)
 * - Check for Updates with live status & feedback
 * - App Version & build metadata at bottom
 */
export function SettingsScreen() {
  const {
    language,
    theme,
    lastCheckedForUpdates,
    isCheckingUpdate,
    updateStatus,
    updateMessage,
    loaded,
    initStore,
    setLanguage,
    setTheme,
    checkForUpdates,
  } = useSettingsStore();

  useEffect(() => {
    if (!loaded) {
      void initStore();
    }
  }, [loaded, initStore]);

  return (
    <View style={styles.container}>
      {/* Fixed Header (Never Scrolls) */}
      <ScreenHeader
        title="Settings /"
        titleAccent="सेटिंग्स"
        subtitle="Language, theme & updates"
      />

      {/* Scrollable Content Area */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: Language Selector */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconChip, { backgroundColor: colors.accentBlueTint }]}>
              <MaterialCommunityIcons name="translate" size={22} color={colors.accentBlue} />
            </View>
            <View style={styles.cardHeaderTextWrap}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.cardTitleEn}>App Language</Text>
                <Text style={styles.cardTitleHi}>भाषा चयन</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Choose your default interface display language
              </Text>
            </View>
          </View>

          <View style={styles.optionsList}>
            {LANGUAGE_OPTIONS.map((opt) => {
              const isSelected = language === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => void setLanguage(opt.id)}
                  style={({ pressed }) => [
                    styles.radioOptionItem,
                    isSelected && styles.radioOptionItemSelected,
                    pressed && styles.itemPressed,
                  ]}
                >
                  <View style={styles.radioTextWrap}>
                    <View style={styles.radioTitleRow}>
                      <Text style={[styles.radioTitleEn, isSelected && styles.textBrand]}>
                        {opt.titleEn}
                      </Text>
                      <Text style={[styles.radioTitleHi, isSelected && styles.textBrand]}>
                        {opt.titleHi}
                      </Text>
                    </View>
                    <Text style={styles.radioDesc}>{opt.desc}</Text>
                  </View>

                  <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                    {isSelected && (
                      <Ionicons name="checkmark-sharp" size={14} color={colors.surface} />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Card 2: Appearance & Theme */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconChip, { backgroundColor: colors.accentPurpleTint }]}>
              <MaterialCommunityIcons
                name="theme-light-dark"
                size={22}
                color={colors.accentPurple}
              />
            </View>
            <View style={styles.cardHeaderTextWrap}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.cardTitleEn}>Theme & Appearance</Text>
                <Text style={styles.cardTitleHi}>थीम</Text>
              </View>
              <Text style={styles.cardSubtitle}>Select your visual theme preference</Text>
            </View>
          </View>

          {/* 3-Column Theme Tiles */}
          <View style={styles.themeGrid}>
            {THEME_OPTIONS.map((opt) => {
              const isSelected = theme === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => void setTheme(opt.id)}
                  style={({ pressed }) => [
                    styles.themeTile,
                    isSelected && styles.themeTileSelected,
                    pressed && styles.itemPressed,
                  ]}
                >
                  <View
                    style={[styles.themeTileIconBox, isSelected && styles.themeTileIconBoxSelected]}
                  >
                    <Ionicons
                      name={opt.iconName}
                      size={20}
                      color={isSelected ? colors.brand : colors.textSecondary}
                    />
                  </View>
                  <Text style={[styles.themeTileLabelEn, isSelected && styles.textBrand]}>
                    {opt.titleEn}
                  </Text>
                  <Text style={[styles.themeTileLabelHi, isSelected && styles.textBrand]}>
                    {opt.titleHi}
                  </Text>

                  {isSelected && (
                    <View style={styles.selectedPillBadge}>
                      <Ionicons name="checkmark" size={10} color={colors.surface} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Card 3: Software Updates */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconChip, { backgroundColor: colors.accentTealTint }]}>
              <MaterialCommunityIcons
                name="cloud-sync-outline"
                size={22}
                color={colors.accentTeal}
              />
            </View>
            <View style={styles.cardHeaderTextWrap}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.cardTitleEn}>App Updates</Text>
                <Text style={styles.cardTitleHi}>सॉफ़्टवेयर अपडेट</Text>
              </View>
              <Text style={styles.cardSubtitle}>
                Check if a newer version of Hindi PDF Editor is available
              </Text>
            </View>
          </View>

          {/* Status Panel */}
          <View style={styles.updateStatusPanel}>
            <View style={styles.updateStatusRow}>
              <View style={styles.statusIndicatorWrapper}>
                {isCheckingUpdate ? (
                  <ActivityIndicator size="small" color={colors.brand} />
                ) : updateStatus === 'latest' ? (
                  <Ionicons name="checkmark-circle" size={20} color={colors.accentGreen} />
                ) : (
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={colors.textSecondary}
                  />
                )}
                <View style={styles.statusTextWrap}>
                  <Text style={styles.statusTitle}>
                    {isCheckingUpdate
                      ? 'Checking for updates...'
                      : (updateMessage ?? `Version ${APP_VERSION} installed`)}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    {lastCheckedForUpdates
                      ? `Last checked: ${lastCheckedForUpdates}`
                      : 'Never checked'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Check Button */}
            <AppButton
              title={isCheckingUpdate ? 'Checking...' : 'Check for Updates / अपडेट जांचें'}
              onPress={() => void checkForUpdates()}
              variant="primary"
              loading={isCheckingUpdate}
            />
          </View>
        </View>

        {/* Bottom App Version Footer */}
        <View style={styles.footer}>
          <View style={styles.footerBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.accentGreen} />
            <Text style={styles.footerBadgeText}>100% Offline & On-Device Engine</Text>
          </View>
          <Text style={styles.footerVersionText}>Hindi PDF Editor • v{APP_VERSION} (Build 1)</Text>
          <Text style={styles.footerSubText}>
            Built with HarfBuzz shaping for perfect Devanagari rendering
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
    gap: spacing.md,
    paddingBottom: 70,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.soft,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  cardTitleEn: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  cardTitleHi: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.brand,
  },
  cardSubtitle: {
    fontSize: 11.5,
    color: colors.textTertiary,
    lineHeight: 15,
  },
  optionsList: {
    gap: spacing.xs + 2,
  },
  radioOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  radioOptionItemSelected: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brand,
  },
  itemPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  radioTextWrap: {
    flex: 1,
    gap: 2,
  },
  radioTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  radioTitleEn: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  radioTitleHi: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  radioDesc: {
    fontSize: 11,
    color: colors.textTertiary,
    lineHeight: 14,
  },
  textBrand: {
    color: colors.brand,
    fontWeight: '800',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  radioButtonSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  themeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  themeTile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    gap: 3,
    position: 'relative',
  },
  themeTileSelected: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brand,
  },
  themeTileIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  themeTileIconBoxSelected: {
    backgroundColor: '#E8EDFF',
  },
  themeTileLabelEn: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  themeTileLabelHi: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  selectedPillBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateStatusPanel: {
    gap: spacing.md,
  },
  updateStatusRow: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
  },
  statusIndicatorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusTextWrap: {
    flex: 1,
    gap: 2,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusSubtitle: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentGreenTint,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    gap: 5,
  },
  footerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentGreen,
  },
  footerVersionText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: -0.2,
  },
  footerSubText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
