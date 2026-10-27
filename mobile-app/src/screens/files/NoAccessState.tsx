import { View } from 'react-native';

import { useUi } from '../../hooks/useAppTheme';
import { useTx } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { PillButton } from '../../ui/PillButton';
import { UiText } from '../../ui/UiText';

/** Storage-access card for the Files sheet: alone when there are no recents, else above them. */
export function NoAccessState({ onAllow, onPick }: { onAllow: () => void; onPick: () => void }) {
  const ui = useUi();
  const tx = useTx();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingHorizontal: 32,
        paddingVertical: 32,
        gap: 16,
      }}
    >
      <Icon name="folder-open" size={56} color={ui.brandOnSurface} />
      <UiText variant="section" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {tx('Find the PDFs on your phone', 'अपने फ़ोन की PDF ढूँढें')}
      </UiText>
      <UiText color={ui.inkSecondary} style={{ textAlign: 'center' }}>
        {tx(
          'Allow file access to list PDFs from Downloads, WhatsApp and Documents. The list is made on your phone.',
          'Downloads, WhatsApp और Documents की PDF दिखाने के लिए फ़ाइल की अनुमति दें। सूची आपके फ़ोन पर ही बनती है।',
        )}
      </UiText>
      <View style={{ alignSelf: 'stretch', gap: 8, marginTop: 8 }}>
        <PillButton title={tx('Allow access', 'अनुमति दें')} onPress={onAllow} />
        <PillButton
          title={tx('Pick one file instead', 'एक फ़ाइल चुनें')}
          kind="text"
          onPress={onPick}
        />
      </View>
    </View>
  );
}
