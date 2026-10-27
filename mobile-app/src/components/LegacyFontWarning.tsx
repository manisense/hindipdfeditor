import { View } from 'react-native';

import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { BottomSheet } from '../ui/BottomSheet';
import { Icon } from '../ui/Icon';
import { PillButton } from '../ui/PillButton';
import { UiText } from '../ui/UiText';

const LEGACY_FONT_ICON_COLOR = '#C2560A';

type Props = {
  visible: boolean;
  /** Closes the sheet; the page stays read-only. Also runs on Android back and scrim tap. */
  onClose: () => void;
  /** Distinct known legacy font names detected on the current page (spec Section 9). */
  fontNames: string[];
  inspectionFailed?: boolean;
  onEnableSafeReplacement?: () => void;
};

/**
 * Sheet shown before editing a page whose embedded font matches a known pre-Unicode Devanagari
 * pattern (KrutiDev, Shivaji, Chanakya, DevLys, etc.) - spec Section 8/9. A known legacy match
 * can enter the explicit raster-only Unicode replacement path: the source stays immutable and
 * the legacy byte mapping is never interpreted as Unicode. Inspection failures fail closed: the
 * sheet offers only OK, with no way to enable editing.
 */
export function LegacyFontWarning({
  visible,
  onClose,
  fontNames,
  inspectionFailed,
  onEnableSafeReplacement,
}: Props) {
  const ui = useUi();
  const tx = useTx();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: 24, gap: 16 }}>
        <Icon
          name={inspectionFailed ? 'block' : 'font-download-off'}
          size={32}
          color={inspectionFailed ? ui.danger : LEGACY_FONT_ICON_COLOR}
        />
        <UiText variant="title" accessibilityRole="header">
          {inspectionFailed
            ? tx("We couldn't check this page's font", 'इस पृष्ठ का फ़ॉन्ट जाँचा नहीं जा सका')
            : tx('This page uses an old Hindi font', 'इस पृष्ठ में पुराना हिंदी फ़ॉन्ट है')}
        </UiText>
        {!inspectionFailed && fontNames.length > 0 && (
          <UiText variant="meta" color={ui.inkSecondary}>
            {`${tx('Found:', 'मिला:')} ${fontNames.join(', ')}`}
          </UiText>
        )}
        <UiText color={ui.inkSecondary}>
          {inspectionFailed
            ? tx(
                'To keep your text correct, editing is off for this page. You can still read it, or edit other pages.',
                'टेक्स्ट सही रखने के लिए इस पृष्ठ पर एडिट बंद है। आप इसे पढ़ सकते हैं या दूसरे पृष्ठ एडिट कर सकते हैं।',
              )
            : tx(
                "Its lines can't be changed one by one. You can cover old text and type new Hindi on top. The original page stays as it is.",
                'इसकी पंक्तियाँ एक-एक करके नहीं बदल सकतीं। आप पुराना टेक्स्ट ढककर ऊपर नई हिंदी लिख सकते हैं। मूल पृष्ठ वैसा ही रहता है।',
              )}
        </UiText>
        <View style={{ gap: 8, marginTop: 8 }}>
          {inspectionFailed || !onEnableSafeReplacement ? (
            <PillButton title={tx('OK', 'ठीक है')} onPress={onClose} />
          ) : (
            <>
              <PillButton
                title={tx('Cover and retype', 'ढककर लिखें')}
                onPress={onEnableSafeReplacement}
              />
              <PillButton title={tx('Just read', 'सिर्फ़ पढ़ें')} kind="tonal" onPress={onClose} />
            </>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}
