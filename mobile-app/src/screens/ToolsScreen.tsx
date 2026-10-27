import { useState, useRef, useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AboutModal } from '../components/AboutModal';
import type { ToolId } from '../components/ToolShell';
import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { BandIconButton } from '../ui/BandIconButton';
import { BrandBand, useBandCollapse } from '../ui/BrandBand';
import { Icon, type IconName } from '../ui/Icon';
import { NAV_CLEARANCE, uiRadius } from '../ui/tokens';
import { UiText } from '../ui/UiText';

type Props = {
  onOpenTool: (toolId: ToolId) => void;
};

type TileColor = 'edit' | 'translate' | 'pages' | 'size' | 'read';

type ToolTile = {
  id: ToolId;
  icon: IconName;
  color: TileColor;
  en: string;
  hi: string;
  descEn: string;
  descHi: string;
};

const GROUPS: { en: string; hi: string; tiles: ToolTile[] }[] = [
  {
    en: 'Change text',
    hi: 'टेक्स्ट बदलें',
    tiles: [
      {
        id: 'edit',
        icon: 'edit',
        color: 'edit',
        en: 'Edit Hindi text',
        hi: 'हिंदी टेक्स्ट बदलें',
        descEn: 'Tap a line and type new words',
        descHi: 'पंक्ति टैप करें, नए शब्द लिखें',
      },
      {
        id: 'translate',
        icon: 'translate',
        color: 'translate',
        en: 'Translate',
        hi: 'अनुवाद करें',
        descEn: 'Hindi ⇄ English, needs internet',
        descHi: 'हिंदी ⇄ अंग्रेज़ी, इंटरनेट चाहिए',
      },
    ],
  },
  {
    en: 'Pages',
    hi: 'पृष्ठ',
    tiles: [
      {
        id: 'merge',
        icon: 'merge-type',
        color: 'pages',
        en: 'Merge PDFs',
        hi: 'PDF जोड़ें',
        descEn: 'Join files in your order',
        descHi: 'अपने क्रम में फ़ाइलें जोड़ें',
      },
      {
        id: 'split',
        icon: 'call-split',
        color: 'pages',
        en: 'Split PDF',
        hi: 'PDF अलग करें',
        descEn: 'Keep only the pages you need',
        descHi: 'सिर्फ़ ज़रूरी पृष्ठ रखें',
      },
    ],
  },
  {
    en: 'File size',
    hi: 'फ़ाइल साइज़',
    tiles: [
      {
        id: 'compress',
        icon: 'compress',
        color: 'size',
        en: 'Compress',
        hi: 'छोटा करें',
        descEn: 'Smaller file for WhatsApp',
        descHi: 'WhatsApp के लिए छोटी फ़ाइल',
      },
    ],
  },
  {
    en: 'Reading',
    hi: 'पढ़ना',
    tiles: [
      {
        id: 'viewer',
        icon: 'menu-book',
        color: 'read',
        en: 'Read',
        hi: 'पढ़ें',
        descEn: 'Open a PDF to read',
        descHi: 'पढ़ने के लिए PDF खोलें',
      },
    ],
  },
];

/** Tools tab: brand band and four groups of two-column tiles, each with a short description. */
export function ToolsScreen({ onOpenTool }: Props) {
  const tx = useTx();
  const ui = useUi();
  const surface = useAppTheme().colors.surface;
  const [aboutVisible, setAboutVisible] = useState(false);
  const bandListRef = useRef<ScrollView>(null);
  const band = useBandCollapse(
    useCallback((y) => bandListRef.current?.scrollTo({ y, animated: true }), []),
  );

  return (
    <>
      <BrandBand
        title={tx('Tools', 'टूल')}
        scrollY={band.scrollY}
        onCollapseDistance={band.setDistance}
        actions={
          <BandIconButton
            icon="more-vert"
            label={tx('More options', 'और विकल्प')}
            onPress={() => setAboutVisible(true)}
          />
        }
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: NAV_CLEARANCE }}
          onScroll={band.onScroll}
          scrollEventThrottle={band.scrollEventThrottle}
          ref={bandListRef}
          onScrollEndDrag={band.onScrollEndDrag}
          onMomentumScrollEnd={band.onMomentumScrollEnd}
        >
          {GROUPS.map((group) => (
            <View key={group.en}>
              <UiText
                color={ui.inkLabel}
                accessibilityRole="header"
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  paddingTop: 12,
                  paddingHorizontal: 16,
                  paddingBottom: 8,
                }}
              >
                {tx(group.en, group.hi)}
              </UiText>
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 }}
              >
                {group.tiles.map((tile) => {
                  const name = tx(tile.en, tile.hi);
                  const description = tx(tile.descEn, tile.descHi);
                  return (
                    <Pressable
                      key={tile.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${name}. ${description}`}
                      onPress={() => onOpenTool(tile.id)}
                      android_ripple={{ color: ui.fill }}
                      style={{
                        flexBasis: '47%',
                        maxWidth: '47%',
                        minHeight: 48,
                        padding: 14,
                        gap: 6,
                        borderRadius: uiRadius.tile,
                        backgroundColor: surface,
                        borderWidth: 1,
                        borderColor: ui.ring,
                        elevation: 1,
                      }}
                    >
                      <Icon name={tile.icon} size={28} color={ui.category[tile.color]} />
                      <UiText color={ui.ink} style={{ fontSize: 15, fontWeight: '600' }}>
                        {name}
                      </UiText>
                      <UiText color={ui.inkSecondary} style={{ fontSize: 13 }}>
                        {description}
                      </UiText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </BrandBand>
      <AboutModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
    </>
  );
}
