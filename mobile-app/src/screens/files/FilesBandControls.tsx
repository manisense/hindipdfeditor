import type { RefObject } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { useIsHindi, useTx } from '../../i18n';
import { Icon, type IconName } from '../../ui/Icon';
import { ui as lightUi, uiFont, uiRadius } from '../../ui/tokens';
import { UiText } from '../../ui/UiText';

export type SourceTab = 'all' | 'downloads' | 'whatsapp' | 'documents' | 'starred';

const TABS: { id: SourceTab; en: string; hi: string }[] = [
  { id: 'all', en: 'All', hi: 'सभी' },
  { id: 'downloads', en: 'Downloads', hi: 'डाउनलोड' },
  { id: 'whatsapp', en: 'WhatsApp', hi: 'व्हाट्सऐप' },
  { id: 'documents', en: 'Documents', hi: 'दस्तावेज़' },
  { id: 'starred', en: 'Starred', hi: 'स्टार किए' },
];

/** 48x48dp white icon button for the brand band. */
export function BandIconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: 'rgba(255,255,255,0.2)', borderless: true, radius: 24 }}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={24} color="#FFFFFF" />
    </Pressable>
  );
}

/** White 48dp search pill on the band. Colours stay light-theme because the pill is always white. */
export function BandSearchField({
  inputRef,
  value,
  onChangeText,
}: {
  inputRef: RefObject<TextInput | null>;
  value: string;
  onChangeText: (text: string) => void;
}) {
  const tx = useTx();
  const hindi = useIsHindi();
  const placeholder = tx('Search PDFs on this phone', 'फ़ोन की PDF खोजें');
  return (
    <View
      style={{
        height: 48,
        marginHorizontal: 16,
        paddingLeft: 16,
        borderRadius: uiRadius.pill,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Icon name="search" size={24} color={lightUi.inkSecondary} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={lightUi.inkSecondary}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        style={{
          flex: 1,
          height: 48,
          padding: 0,
          fontSize: 16,
          fontFamily: hindi ? uiFont.devanagari : uiFont.latin,
          color: lightUi.ink,
        }}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('Clear search', 'खोज साफ़ करें')}
          onPress={() => onChangeText('')}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" size={20} color={lightUi.inkSecondary} />
        </Pressable>
      ) : (
        <View style={{ width: 4 }} />
      )}
    </View>
  );
}

/** Horizontally scrolling white text tabs; the active tab has a 3dp white underline. */
export function SourceTabs({
  active,
  onChange,
}: {
  active: SourceTab;
  onChange: (tab: SourceTab) => void;
}) {
  const tx = useTx();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      style={{ marginTop: 8, flexGrow: 0 }}
      contentContainerStyle={{ paddingHorizontal: 4 }}
    >
      {TABS.map((tab) => {
        const selected = tab.id === active;
        const label = tx(tab.en, tab.hi);
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={{ height: 48, paddingHorizontal: 12, justifyContent: 'center' }}
          >
            <UiText
              color={selected ? '#FFFFFF' : 'rgba(255,255,255,0.72)'}
              style={{ fontSize: 15, fontWeight: '500' }}
            >
              {label}
            </UiText>
            {selected ? (
              <View
                style={{
                  position: 'absolute',
                  left: 12,
                  right: 12,
                  bottom: 0,
                  height: 3,
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                  backgroundColor: '#FFFFFF',
                }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
