import { useState, type ReactNode } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../../hooks/useAppTheme';
import { useTx } from '../../i18n';
import { Icon, type IconName } from '../../ui/Icon';
import { PillButton } from '../../ui/PillButton';
import { uiFont, uiRadius } from '../../ui/tokens';
import { UiText } from '../../ui/UiText';

/** Smallest and largest text size the size picker allows, and its step, in PDF points. */
export const MIN_FONT_SIZE_PT = 6;
export const MAX_FONT_SIZE_PT = 72;
const FONT_SIZE_STEP_PT = 1;

/** Ink colours offered besides the colour sampled from the original line. */
const COLOR_PRESETS: { value: string; en: string; hi: string }[] = [
  { value: '#14161F', en: 'Black', hi: 'काला' },
  { value: '#1843DD', en: 'Blue', hi: 'नीला' },
  { value: '#C6303E', en: 'Red', hi: 'लाल' },
  { value: '#16A34A', en: 'Green', hi: 'हरा' },
  { value: '#FFFFFF', en: 'White', hi: 'सफ़ेद' },
];

type Picker = 'size' | 'color' | null;

/**
 * Sheet docked at the bottom of the editor (the editor's `KeyboardAvoidingView` keeps it above
 * the keyboard) for the line being changed. Shows `Was:` and the original line when there is
 * one, a multiline Devanagari input (18dp, 2dp brand border, radius 16), and chips for Font,
 * size, colour and bold, then Done. The page shows the new text live through the line's
 * `EditableTextOverlay`. The size chip opens a − / value / + picker and the colour dot a row of
 * swatches; the first swatch is the colour the line had when the sheet opened (the sampled ink
 * colour for a detected line). Restore original drops the change and its cover.
 *
 * @param sizePt Text size in PDF points, the same unit as `TextEdit.fontSizePt`.
 * @param onSize Receives the new size in PDF points, clamped to 6–72.
 */
export function LineEditSheet({
  originalText,
  value,
  onChange,
  fontLabel,
  sizePt,
  color,
  bold,
  onFont,
  onSize,
  onColor,
  onBold,
  onDone,
  onRestore,
}: {
  originalText: string;
  value: string;
  onChange: (s: string) => void;
  fontLabel: string;
  sizePt: number;
  color: string;
  bold: boolean;
  onFont: () => void;
  onSize: (pt: number) => void;
  onColor: (c: string) => void;
  onBold: () => void;
  onDone: () => void;
  /** Drops this line's change and its cover, so the page shows the source text again. */
  onRestore: () => void;
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const tx = useTx();
  const insets = useSafeAreaInsets();
  const [picker, setPicker] = useState<Picker>(null);
  const [startColor] = useState(color);
  const sizeLabel = `${Math.round(sizePt)} pt`;
  const swatches = [
    { value: startColor, label: tx('Original colour', 'मूल रंग') },
    ...COLOR_PRESETS.filter((p) => p.value.toLowerCase() !== startColor.toLowerCase()).map((p) => ({
      value: p.value,
      label: tx(p.en, p.hi),
    })),
  ];
  const togglePicker = (next: Exclude<Picker, null>) =>
    setPicker((current) => (current === next ? null : next));

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: uiRadius.sheet,
        borderTopRightRadius: uiRadius.sheet,
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 12 + insets.bottom,
        gap: 12,
        elevation: 8,
      }}
    >
      {originalText ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <UiText variant="label" color={ui.inkSecondary} style={{ fontSize: 13 }}>
            {tx('Was:', 'पहले:')}
          </UiText>
          <UiText
            color={ui.inkSecondary}
            numberOfLines={2}
            style={{ flex: 1, fontFamily: uiFont.devanagari, fontSize: 13, lineHeight: 20 }}
          >
            {originalText}
          </UiText>
        </View>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChange}
        autoFocus
        multiline
        accessibilityLabel={tx('New text', 'नया टेक्स्ट')}
        placeholder={tx('Type here', 'यहाँ लिखें')}
        placeholderTextColor={ui.inkTertiary}
        style={{
          minHeight: 56,
          maxHeight: 128,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderWidth: 2,
          borderColor: ui.brand,
          borderRadius: 16,
          color: ui.ink,
          fontFamily: uiFont.devanagari,
          fontSize: 18,
          lineHeight: 28,
          textAlignVertical: 'top',
        }}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <SheetChip
          icon="font-download"
          label={fontLabel}
          a11yLabel={`${tx('Font', 'फ़ॉन्ट')}: ${fontLabel}`}
          onPress={onFont}
        />
        <SheetChip
          label={sizeLabel}
          a11yLabel={`${tx('Size', 'आकार')}: ${sizeLabel}`}
          selected={picker === 'size'}
          onPress={() => togglePicker('size')}
        />
        <SheetChip
          a11yLabel={tx('Colour', 'रंग')}
          selected={picker === 'color'}
          onPress={() => togglePicker('color')}
        >
          <ColorDot color={color} />
        </SheetChip>
        <SheetChip
          icon="format-bold"
          a11yLabel={tx('Bold', 'बोल्ड')}
          selected={bold}
          onPress={onBold}
        />
      </View>
      {picker === 'size' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}>
          <StepButton
            icon="remove"
            label={tx('Smaller text', 'छोटा टेक्स्ट')}
            disabled={sizePt <= MIN_FONT_SIZE_PT}
            onPress={() => onSize(Math.max(MIN_FONT_SIZE_PT, sizePt - FONT_SIZE_STEP_PT))}
          />
          <UiText
            accessibilityLiveRegion="polite"
            style={{ minWidth: 64, textAlign: 'center', fontWeight: '600' }}
          >
            {sizeLabel}
          </UiText>
          <StepButton
            icon="add"
            label={tx('Bigger text', 'बड़ा टेक्स्ट')}
            disabled={sizePt >= MAX_FONT_SIZE_PT}
            onPress={() => onSize(Math.min(MAX_FONT_SIZE_PT, sizePt + FONT_SIZE_STEP_PT))}
          />
        </View>
      ) : null}
      {picker === 'color' ? (
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {swatches.map((swatch) => {
            const selected = swatch.value.toLowerCase() === color.toLowerCase();
            return (
              <Pressable
                key={swatch.value}
                accessibilityRole="radio"
                accessibilityLabel={swatch.label}
                accessibilityState={{ checked: selected }}
                onPress={() => onColor(swatch.value)}
                style={{
                  width: 48,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    padding: 3,
                    borderRadius: 9999,
                    borderWidth: 2,
                    borderColor: selected ? ui.brandOnSurface : 'transparent',
                  }}
                >
                  <ColorDot color={swatch.value} />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <PillButton
          kind="text"
          icon="restore"
          title={tx('Restore original', 'मूल वापस लाएँ')}
          onPress={onRestore}
        />
        <PillButton title={tx('Done', 'हो गया')} onPress={onDone} />
      </View>
    </View>
  );
}

function ColorDot({ color }: { color: string }) {
  const ui = useUi();
  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 9999,
        backgroundColor: color,
        borderWidth: 1,
        borderColor: ui.ring,
      }}
    />
  );
}

/** 40dp-tall pill chip with a 48dp touch target; brand tint when selected. */
function SheetChip({
  icon,
  label,
  a11yLabel,
  selected,
  onPress,
  children,
}: {
  icon?: IconName;
  label?: string;
  a11yLabel: string;
  selected?: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  const ui = useUi();
  const fg = selected ? ui.brandOnSurface : ui.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: false }}
      style={{
        height: 40,
        minWidth: 48,
        paddingHorizontal: 12,
        borderRadius: 9999,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: selected ? ui.brandTint : ui.fill,
      }}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      {label ? (
        <UiText variant="label" color={fg} style={{ fontSize: 14 }}>
          {label}
        </UiText>
      ) : null}
      {children}
    </Pressable>
  );
}

function StepButton({
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
  const ui = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: true, radius: 24 }}
      style={{
        width: 48,
        height: 48,
        borderRadius: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ui.fill,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Icon name={icon} size={22} color={ui.ink} />
    </Pressable>
  );
}
