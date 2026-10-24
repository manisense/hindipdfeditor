import { Pressable, View } from 'react-native';

import { useUi } from '../hooks/useAppTheme';
import { uiDark } from './tokens';
import { UiText } from './UiText';

/** Filter chip: 32dp tall visible pill inside a 48dp touch target. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const ui = useUi();
  const unselectedText = ui === uiDark ? ui.inkSecondary : '#3F3F46';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ minHeight: 48, justifyContent: 'center' }}
    >
      <View
        style={{
          height: 32,
          borderRadius: 9999,
          overflow: 'hidden',
          justifyContent: 'center',
          paddingHorizontal: 16,
          backgroundColor: selected ? ui.brandTint : 'transparent',
          borderWidth: selected ? 0 : 1,
          borderColor: ui.ring,
        }}
      >
        <UiText variant="label" color={selected ? ui.brandOnSurface : unselectedText}>
          {label}
        </UiText>
      </View>
    </Pressable>
  );
}
