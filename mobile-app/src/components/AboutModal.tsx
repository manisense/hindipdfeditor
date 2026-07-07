import { Linking, Modal, StyleSheet, Text, View } from 'react-native';

import { AppButton } from './AppButton';
import { APP_VERSION, PRIVACY_POLICY_URL } from '../constants/legal';
import { colors, radius, spacing } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * About / legal sheet required for Play Store compliance: app version, privacy policy link,
 * and a plain-language summary of what data leaves the device (only the opt-in AI feature).
 */
export function AboutModal({ visible, onClose }: Props) {
  const openPrivacy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
      // No network or no handler — user can try again later.
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>About</Text>
          <Text style={styles.version}>Version {APP_VERSION}</Text>
          <Text style={styles.body}>
            Hindi PDF Editor lets you change Hindi and English text in scanned or digital PDFs on
            your device. Core editing (open, OCR, mask, export) works fully offline — your PDFs
            never leave your phone unless you turn on Enhance with AI.
          </Text>
          <Text style={styles.sectionTitle}>Your data</Text>
          <Text style={styles.body}>
            • PDFs you open stay on your device{'\n'}• On-device OCR uses Google ML Kit bundled
            in the app (offline){'\n'}• Enhance with AI (optional) sends one page image to
            Google&apos;s Gemini API using your own API key
          </Text>
          <AppButton title="Privacy policy" small variant="secondary" onPress={openPrivacy} />
          <AppButton title="Close" small variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  version: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
