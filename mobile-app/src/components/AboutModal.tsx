import {
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import { useThemedStyles } from '../hooks/useAppTheme';
import { APP_VERSION, PRIVACY_POLICY_URL } from '../constants/legal';
import { type Theme, radius, shadows, spacing } from '../theme';
import { AppButton } from './AppButton';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * About / legal sheet required for Play Store compliance: app version, privacy policy link,
 * and a plain-language summary of what data leaves the device (only the opt-in AI feature).
 */
export function AboutModal({ visible, onClose }: Props) {
  const { height } = useWindowDimensions();
  const styles = useThemedStyles(getStyles);

  const openPrivacy = () => {
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
      // No network or no handler — user can try again later.
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView
          style={[styles.card, { maxHeight: Math.max(280, height - spacing.xl * 2) }]}
          contentContainerStyle={styles.cardContent}
          showsVerticalScrollIndicator={false}
          accessibilityViewIsModal
        >
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
              accessibilityLabel="Hindi PDF Editor logo"
            />
            <View style={styles.brandText}>
              <Text style={styles.title}>Hindi PDF Editor</Text>
              <Text style={styles.version}>Version {APP_VERSION}</Text>
            </View>
          </View>
          <Text style={styles.body}>
            Hindi PDF Editor lets you change Hindi and English text in scanned or digital PDFs on
            your device. Core editing (open, OCR, mask, export) works fully offline — your PDFs
            never leave your phone unless you explicitly use AI OCR or Translate.
          </Text>
          <Text style={styles.sectionTitle}>Your data</Text>
          <Text style={styles.body}>
            • PDFs you open stay on your device{'\n'}• On-device OCR uses Google ML Kit bundled in
            the app (offline){'\n'}• AI OCR (optional) sends one page image through our secure
            service to Google&apos;s Gemini API{'\n'}• Translate (optional) sends detected line text
            through that service for Hindi ↔ English translation{'\n'}• The Gemini API key is never
            included in the app
          </Text>
          <AppButton title="Privacy policy" small variant="secondary" onPress={openPrivacy} />
          <AppButton title="Close" small variant="ghost" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const getStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(20, 22, 31, 0.65)',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...shadows.popup,
    },
    cardContent: {
      padding: spacing.xl,
      gap: spacing.md,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    logo: {
      width: 48,
      height: 48,
      borderRadius: radius.chip,
    },
    brandText: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 18,
      fontWeight: '800',
      color: theme.colors.textPrimary,
    },
    version: {
      fontSize: 13,
      color: theme.colors.textSecondary,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginTop: spacing.xs,
    },
    body: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
  });
