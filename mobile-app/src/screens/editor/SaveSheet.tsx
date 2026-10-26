import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useUi } from '../../hooks/useAppTheme';
import { useTx } from '../../i18n';
import { BottomSheet } from '../../ui/BottomSheet';
import { Icon } from '../../ui/Icon';
import { PillButton } from '../../ui/PillButton';
import { UiText } from '../../ui/UiText';

/**
 * "Save as a new PDF" sheet: the never-changed promise, a file-name field (prefilled with
 * `defaultName`, `.pdf` shown after it), the `changedSummary` line, then Save to phone and
 * Share. Both pass the typed name up unchanged; the caller sanitises it. Mount it with a new
 * `key` each time it opens so the field starts from `defaultName` again.
 */
export function SaveSheet({
  visible,
  defaultName,
  changedSummary,
  onSave,
  onShare,
  onClose,
}: {
  visible: boolean;
  defaultName: string;
  changedSummary: string;
  onSave: (name: string) => void;
  /** Gets the typed name as well, so a renamed file is shared under that name. */
  onShare: (name: string) => void;
  onClose: () => void;
}) {
  const ui = useUi();
  const tx = useTx();
  const [name, setName] = useState(defaultName);
  const label = tx('File name', 'फ़ाइल का नाम');
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={tx('Save as a new PDF', 'नई PDF के रूप में सेव करें')}
    >
      <View style={{ paddingHorizontal: 24, paddingTop: 12, gap: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="verified-user" size={20} color={ui.success} />
          <UiText variant="meta" color={ui.success} style={{ flex: 1, fontWeight: '500' }}>
            {tx('Your original file is never changed.', 'आपकी मूल फ़ाइल कभी नहीं बदलती।')}
          </UiText>
        </View>
        <View style={{ gap: 8 }}>
          <UiText variant="label" color={ui.inkLabel}>
            {label}
          </UiText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 56,
              paddingHorizontal: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: ui.ring,
              backgroundColor: ui.fill,
            }}
          >
            <TextInput
              value={name}
              onChangeText={setName}
              accessibilityLabel={label}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => onSave(name)}
              style={{ flex: 1, minHeight: 48, fontSize: 16, color: ui.ink }}
            />
            <UiText color={ui.inkSecondary}>.pdf</UiText>
          </View>
          <UiText variant="meta" color={ui.inkSecondary}>
            {changedSummary}
          </UiText>
        </View>
        <PillButton title={tx('Save to phone', 'फ़ोन में सेव करें')} onPress={() => onSave(name)} />
        <PillButton
          kind="tonal"
          icon="share"
          title={tx('Share', 'शेयर करें')}
          onPress={() => onShare(name)}
        />
      </View>
    </BottomSheet>
  );
}
