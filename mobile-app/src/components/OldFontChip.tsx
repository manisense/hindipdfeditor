import { Pressable } from 'react-native';

import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { Icon } from '../ui/Icon';
import { UiText } from '../ui/UiText';

const LEGACY_FONT_ICON_COLOR = '#C2560A';

/**
 * Persistent pill marking a known old-font page that is in cover-and-retype (raster-only Unicode
 * replacement) mode. Tapping it reopens the old-font sheet.
 */
export function OldFontChip({ onPress }: { onPress: () => void }) {
  const ui = useUi();
  const tx = useTx();
  return (
    <Pressable
      accessibilityRole="text"
      accessibilityLabel={tx(
        'Old font page. Old text is covered and new text is typed on top. The original page is not changed.',
        'पुराने फ़ॉन्ट वाला पृष्ठ। पुराना टेक्स्ट ढका जाता है और नया टेक्स्ट ऊपर लिखा जाता है। मूल पृष्ठ नहीं बदलता।',
      )}
      accessibilityHint={tx('Opens details', 'जानकारी खोलता है')}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 32,
        paddingHorizontal: 12,
        borderRadius: 9999,
        backgroundColor: ui.fill,
      }}
    >
      <Icon name="font-download-off" size={16} color={LEGACY_FONT_ICON_COLOR} />
      <UiText variant="label" color={ui.ink}>
        {tx('Old font page', 'पुराने फ़ॉन्ट वाला पृष्ठ')}
      </UiText>
    </Pressable>
  );
}
