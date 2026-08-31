import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, shadows, spacing } from '../theme';

export function ProfileScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* App Header Card with Brand Logo */}
      <View style={styles.profileCard}>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logoImage}
          accessibilityLabel="Hindi PDF Editor logo"
        />
        <View style={styles.profileDetails}>
          <Text style={styles.userName}>Hindi PDF Editor</Text>
          <Text style={styles.userRole}>हिंदी पीडीएफ संपादक</Text>
        </View>
      </View>

      {/* Security & Offline Badge Card */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="shield-checkmark" size={24} color={colors.accentGreen} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>100% Private & On-Device</Text>
            <Text style={styles.infoDesc}>
              All PDF rendering, editing, OCR, and export operations happen entirely on your local
              device. Your documents are never uploaded to any server.
            </Text>
          </View>
        </View>
      </View>

      {/* Typography & Devanagari Engine Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Devanagari Font Engine</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Active Font Family</Text>
          <Text style={styles.settingValue}>Noto Sans Devanagari</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Secondary Font</Text>
          <Text style={styles.settingValue}>Mukta (Downloadable)</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Complex Text Shaping</Text>
          <Text style={styles.settingValue}>HarfBuzz Native Engine</Text>
        </View>
      </View>

      {/* App Version & Legal Info */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Application Information</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>App Version</Text>
          <Text style={styles.settingValue}>1.0.0 (Expo SDK 56)</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>License</Text>
          <Text style={styles.settingValue}>MIT License</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: spacing.md,
    gap: spacing.md,
    paddingBottom: 60,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.card,
  },
  logoImage: {
    width: 54,
    height: 54,
    borderRadius: radius.chip,
    ...shadows.soft,
  },
  profileDetails: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.4,
  },
  userRole: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: colors.accentGreenTint,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.25)',
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  infoTextContainer: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accentGreen,
  },
  infoDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.soft,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: spacing.xs,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  settingLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '700',
  },
});
