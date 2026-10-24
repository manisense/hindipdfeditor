import { Pressable, View } from 'react-native';

import { useUi } from '../hooks/useAppTheme';
import { uiDark } from './tokens';
import { UiText } from './UiText';

/**
 * Single-choice segmented control. Track has 4dp padding; each option is 40dp tall and the
 * vertical padding brings the touch target to 48dp.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const ui = useUi();
  const selectedBg = ui === uiDark ? '#2E3140' : '#FFFFFF';
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', backgroundColor: ui.fill, borderRadius: 9999, padding: 4 }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: false }}
            hitSlop={{ top: 4, bottom: 4 }}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 9999,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? selectedBg : 'transparent',
              elevation: selected ? 1 : 0,
            }}
          >
            <UiText variant="label" color={selected ? ui.ink : ui.inkSecondary} numberOfLines={1}>
              {option.label}
            </UiText>
          </Pressable>
        );
      })}
    </View>
  );
}
