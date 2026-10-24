import { View } from 'react-native';

import { useUi } from '../../hooks/useAppTheme';
import { Icon, type IconName } from '../../ui/Icon';
import { UiText } from '../../ui/UiText';

/** Centred start state shown before a tool has a file; the pick action sits in the action bar. */
export function ToolPickPrompt({
  icon,
  iconColor,
  title,
  body,
}: {
  icon: IconName;
  iconColor: string;
  title: string;
  body: string;
}) {
  const ui = useUi();
  return (
    <View style={{ paddingTop: 64, paddingHorizontal: 32, alignItems: 'center', gap: 12 }}>
      <Icon name={icon} size={48} color={iconColor} />
      <UiText variant="title" style={{ textAlign: 'center', marginTop: 8 }}>
        {title}
      </UiText>
      <UiText variant="body" color={ui.inkSecondary} style={{ textAlign: 'center' }}>
        {body}
      </UiText>
    </View>
  );
}
