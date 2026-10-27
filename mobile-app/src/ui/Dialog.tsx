import { Modal, Pressable, View } from 'react-native';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { Icon, type IconName } from './Icon';
import { uiDark } from './tokens';
import { UiText } from './UiText';

/** Centred confirm dialog: 24dp side margins, 28dp radius, 40dp-tall text actions. */
export function Dialog({
  visible,
  icon,
  iconColor,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  icon?: IconName;
  iconColor?: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const bodyColor = ui === uiDark ? ui.inkSecondary : '#3F3F46';
  const actions = [
    ...(cancelLabel ? [{ label: cancelLabel, onPress: onCancel }] : []),
    { label: confirmLabel, onPress: onConfirm },
  ];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          backgroundColor: ui.scrim,
        }}
      >
        <View
          accessibilityRole="alert"
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: 28,
            paddingTop: 24,
            paddingHorizontal: 24,
            paddingBottom: 16,
          }}
        >
          {icon ? (
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <Icon name={icon} size={24} color={iconColor ?? ui.brandOnSurface} />
            </View>
          ) : null}
          <UiText
            variant="title"
            accessibilityRole="header"
            style={{ textAlign: 'center', marginBottom: 16 }}
          >
            {title}
          </UiText>
          <UiText color={bodyColor} style={{ fontSize: 15, lineHeight: 22 }}>
            {body}
          </UiText>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
            {actions.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                onPress={action.onPress}
                android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: false }}
                hitSlop={{ top: 4, bottom: 4 }}
                style={{
                  height: 40,
                  paddingHorizontal: 12,
                  borderRadius: 9999,
                  overflow: 'hidden',
                  justifyContent: 'center',
                }}
              >
                <UiText color={ui.brandOnSurface} style={{ fontSize: 14, fontWeight: '600' }}>
                  {action.label}
                </UiText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
