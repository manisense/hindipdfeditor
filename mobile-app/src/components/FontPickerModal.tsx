import { ActivityIndicator, Pressable, View } from 'react-native';

import { useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { DEVANAGARI_FONT_CATALOG, type DevanagariFontFamily } from '../lib/fontAsset';
import { BottomSheet } from '../ui/BottomSheet';
import { Icon } from '../ui/Icon';
import { uiFont } from '../ui/tokens';
import { UiText } from '../ui/UiText';

const HINDI_SAMPLE = 'हिंदी दस्तावेज़';

type Props = {
  visible: boolean;
  selectedFamily: DevanagariFontFamily;
  loadedFamilies: ReadonlySet<DevanagariFontFamily>;
  downloadingFamily: DevanagariFontFamily | null;
  onChoose: (family: DevanagariFontFamily) => void;
  onClose: () => void;
};

/**
 * Curated Unicode-only font picker sheet; legacy-encoded font files are never offered. A font
 * not yet on the phone shows its sample in the default Devanagari font, so opening the sheet
 * never downloads anything.
 */
export function FontPickerModal({
  visible,
  selectedFamily,
  loadedFamilies,
  downloadingFamily,
  onChoose,
  onClose,
}: Props) {
  const ui = useUi();
  const tx = useTx();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={tx('Font', 'फ़ॉन्ट')}>
      <View accessibilityRole="radiogroup" style={{ marginTop: 8 }}>
        {DEVANAGARI_FONT_CATALOG.map((font) => {
          const loaded = loadedFamilies.has(font.family);
          const downloading = downloadingFamily === font.family;
          const selected = selectedFamily === font.family;
          const status = loaded ? tx('On phone', 'फ़ोन पर') : tx('Download', 'डाउनलोड');
          return (
            <Pressable
              key={font.family}
              accessibilityRole="radio"
              accessibilityLabel={`${font.label}. ${status}`}
              accessibilityState={{
                checked: selected,
                disabled: downloadingFamily !== null,
                busy: downloading,
              }}
              disabled={downloadingFamily !== null}
              onPress={() => onChoose(font.family)}
              android_ripple={{ color: 'rgba(9,9,11,0.08)', borderless: false }}
              style={{
                minHeight: 72,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 16,
                paddingHorizontal: 24,
                paddingVertical: 12,
              }}
            >
              <Icon
                name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                color={selected ? ui.brandOnSurface : ui.inkSecondary}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <UiText>{font.label}</UiText>
                <UiText
                  color={ui.inkSecondary}
                  style={{
                    fontSize: 18,
                    fontFamily: loaded ? font.family : uiFont.devanagari,
                  }}
                >
                  {HINDI_SAMPLE}
                </UiText>
              </View>
              {downloading ? (
                <ActivityIndicator color={ui.brandOnSurface} />
              ) : loaded ? (
                <UiText variant="meta" color={ui.inkSecondary}>
                  {status}
                </UiText>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="download" size={20} color={ui.brandOnSurface} />
                  <UiText variant="meta" color={ui.brandOnSurface} style={{ fontWeight: '600' }}>
                    {status}
                  </UiText>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      <UiText
        variant="meta"
        color={ui.inkSecondary}
        style={{ paddingHorizontal: 24, paddingTop: 8 }}
      >
        {tx('Used for new text on this page', 'इस पृष्ठ के नए टेक्स्ट के लिए')}
      </UiText>
    </BottomSheet>
  );
}
