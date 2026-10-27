import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../../hooks/useAppTheme';
import { useTx } from '../../i18n';
import { Icon, type IconName } from '../../ui/Icon';
import { UiText } from '../../ui/UiText';
import { uiRadius } from '../../ui/tokens';

export type ReaderMenuAction =
  'find' | 'goto' | 'translate' | 'theme' | 'print' | 'openWith' | 'info';

const ROWS: { action: ReaderMenuAction; icon: IconName; en: string; hi: string }[] = [
  { action: 'find', icon: 'search', en: 'Find in file', hi: 'फ़ाइल में खोजें' },
  { action: 'goto', icon: 'tag', en: 'Go to page', hi: 'पृष्ठ पर जाएँ' },
  { action: 'translate', icon: 'translate', en: 'Translate', hi: 'अनुवाद करें' },
  { action: 'theme', icon: 'contrast', en: 'Reading theme', hi: 'पढ़ने की थीम' },
  { action: 'print', icon: 'print', en: 'Print', hi: 'प्रिंट करें' },
  { action: 'openWith', icon: 'open-in-new', en: 'Open with', hi: 'इससे खोलें' },
  { action: 'info', icon: 'info', en: 'File info', hi: 'फ़ाइल की जानकारी' },
];

/**
 * Reader overflow menu: a card 8dp from the top-right corner (radius 16, elevation 8) over a
 * clear scrim. `actions` limits the rows to the ones the Reader supports (all by default).
 * Tapping a row closes the menu, then calls `onAction`. Android back and outside taps close it.
 */
export function ReaderMenu({
  visible,
  onClose,
  onAction,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  onAction: (action: ReaderMenuAction) => void;
  actions?: readonly ReaderMenuAction[];
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const tx = useTx();
  const insets = useSafeAreaInsets();
  const rows = actions ? ROWS.filter((row) => actions.includes(row.action)) : ROWS;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('Close menu', 'मेनू बंद करें')}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          accessibilityRole="menu"
          style={{
            position: 'absolute',
            top: insets.top + 8,
            right: 8,
            minWidth: 224,
            paddingVertical: 8,
            borderRadius: uiRadius.fab,
            backgroundColor: theme.colors.surface,
            elevation: 8,
            overflow: 'hidden',
          }}
        >
          {rows.map((row) => (
            <Pressable
              key={row.action}
              accessibilityRole="menuitem"
              accessibilityLabel={tx(row.en, row.hi)}
              onPress={() => {
                onClose();
                onAction(row.action);
              }}
              android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: false }}
              style={{
                minHeight: 48,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <Icon name={row.icon} size={22} color={ui.inkLabel} />
              <UiText variant="body" style={{ fontSize: 15 }}>
                {tx(row.en, row.hi)}
              </UiText>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}
