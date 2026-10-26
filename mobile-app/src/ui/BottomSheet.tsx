import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { UiText } from './UiText';

/**
 * Modal bottom sheet with a 28dp top radius. Closes on scrim tap and on Android back
 * (handled by `Modal.onRequestClose`). Rises above the keyboard when a field in it is focused.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const tx = useTx();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Keeps a text field in the sheet above the keyboard (e.g. the editor's file name). */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('Close', 'बंद करें')}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: ui.scrim,
          }}
        />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: 24 + insets.bottom,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 32,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#D4D4D8',
              marginTop: 8,
              marginBottom: 16,
            }}
          />
          {title ? (
            <UiText variant="title" accessibilityRole="header" style={{ paddingHorizontal: 24 }}>
              {title}
            </UiText>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
