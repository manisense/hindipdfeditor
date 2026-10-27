import { Pressable, View } from 'react-native';

import { useUi } from '../../hooks/useAppTheme';
import { useTx } from '../../i18n';
import type { EditMode } from './editorDocument';
import { Icon, type IconName } from '../../ui/Icon';

/** Button size and active-mode circle size, in dp. */
const BUTTON_SIZE = 48;
const ACTIVE_SIZE = 44;

const MODES: { mode: EditMode; icon: IconName; en: string; hi: string }[] = [
  { mode: 'edit', icon: 'edit', en: 'Change text', hi: 'टेक्स्ट बदलें' },
  { mode: 'addText', icon: 'title', en: 'Add text', hi: 'टेक्स्ट जोड़ें' },
  { mode: 'erase', icon: 'format-color-reset', en: 'Cover old text', hi: 'पुराना टेक्स्ट ढकें' },
];

/**
 * Floating dark editor toolbar (`ui.chrome` pill, elevation 8): the three edit modes, then undo,
 * redo and Show original. The caller positions it (12dp from the sides, 24dp above the bottom
 * inset). Show original is press-and-hold: `onToggleOriginal` fires on press-in and again on
 * release, so the page shows without edits only while the button is held.
 */
export function EditToolbarBar({
  mode,
  onMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  showingOriginal,
  onToggleOriginal,
}: {
  mode: EditMode;
  onMode: (m: EditMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  showingOriginal: boolean;
  onToggleOriginal: () => void;
}) {
  const ui = useUi();
  const tx = useTx();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        paddingHorizontal: 4,
        paddingVertical: 4,
        borderRadius: 9999,
        backgroundColor: ui.chrome,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        elevation: 8,
      }}
    >
      {MODES.map((item) => {
        const active = item.mode === mode;
        return (
          <Pressable
            key={item.mode}
            accessibilityRole="button"
            accessibilityLabel={tx(item.en, item.hi)}
            accessibilityState={{ selected: active }}
            onPress={() => onMode(item.mode)}
            android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 24 }}
            style={buttonStyle}
          >
            <View
              style={{
                width: ACTIVE_SIZE,
                height: ACTIVE_SIZE,
                borderRadius: 9999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? ui.brand : 'transparent',
              }}
            >
              <Icon name={item.icon} size={22} color="#FFFFFF" />
            </View>
          </Pressable>
        );
      })}
      <View
        style={{
          width: 1,
          height: 24,
          marginHorizontal: 4,
          backgroundColor: 'rgba(255,255,255,0.24)',
        }}
      />
      <ToolbarIcon
        icon="undo"
        label={tx('Undo', 'पहले जैसा करें')}
        disabled={!canUndo}
        onPress={onUndo}
      />
      <ToolbarIcon
        icon="redo"
        label={tx('Redo', 'फिर से करें')}
        disabled={!canRedo}
        onPress={onRedo}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('Show original', 'मूल देखें')}
        accessibilityHint={tx(
          'Hold to see the page without your changes',
          'बदलावों के बिना पृष्ठ देखने के लिए दबाकर रखें',
        )}
        accessibilityState={{ selected: showingOriginal }}
        onPressIn={() => {
          if (!showingOriginal) onToggleOriginal();
        }}
        onPressOut={() => {
          if (showingOriginal) onToggleOriginal();
        }}
        android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 24 }}
        style={buttonStyle}
      >
        <Icon name={showingOriginal ? 'visibility-off' : 'visibility'} size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const buttonStyle = {
  width: BUTTON_SIZE,
  height: BUTTON_SIZE,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

function ToolbarIcon({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 24 }}
      style={[buttonStyle, { opacity: disabled ? 0.4 : 1 }]}
    >
      <Icon name={icon} size={22} color="#FFFFFF" />
    </Pressable>
  );
}
