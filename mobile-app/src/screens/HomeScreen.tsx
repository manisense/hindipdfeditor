import { useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AboutModal } from '../components/AboutModal';
import type { ToolId } from '../components/ToolShell';
import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { useRecentFilesStore, type RecentFile } from '../state/recentFilesStore';
import { BandIconButton } from '../ui/BandIconButton';
import { BrandBand, useBandCollapse } from '../ui/BrandBand';
import { Icon, type IconName } from '../ui/Icon';
import { NAV_CLEARANCE, uiFont, uiRadius } from '../ui/tokens';
import { UiText } from '../ui/UiText';

type Props = {
  onOpenTool: (toolId: ToolId) => void;
  onOpenFile: (file: RecentFile) => void;
  onSeeAll: () => void;
  onOpenSearch: () => void;
};

type TileColor = 'edit' | 'translate' | 'pages' | 'size' | 'read';

const TILES: { id: ToolId; icon: IconName; color: TileColor; en: string; hi: string }[] = [
  { id: 'edit', icon: 'edit', color: 'edit', en: 'Edit Hindi', hi: 'हिंदी एडिट' },
  { id: 'translate', icon: 'translate', color: 'translate', en: 'Translate', hi: 'अनुवाद' },
  { id: 'merge', icon: 'merge-type', color: 'pages', en: 'Merge', hi: 'जोड़ें' },
  { id: 'split', icon: 'call-split', color: 'pages', en: 'Split', hi: 'अलग करें' },
  { id: 'compress', icon: 'compress', color: 'size', en: 'Compress', hi: 'छोटा करें' },
  { id: 'viewer', icon: 'menu-book', color: 'read', en: 'Read', hi: 'पढ़ें' },
];

const GAP = 10;
const THUMB_W = 104;
const THUMB_H = 146;

function AppMark() {
  const ui = useUi();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        marginHorizontal: 12,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{ fontFamily: uiFont.devanagari, fontSize: 17, fontWeight: '700', color: ui.brand }}
      >
        हि
      </Text>
    </View>
  );
}

function SearchPill({ placeholder, onPress }: { placeholder: string; onPress: () => void }) {
  const ui = useUi();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={placeholder}
      onPress={onPress}
      style={{
        height: 48,
        marginHorizontal: 16,
        paddingHorizontal: 16,
        borderRadius: uiRadius.pill,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Icon name="search" size={24} color={ui.inkSecondary} />
      <UiText color={ui.inkSecondary} numberOfLines={1} style={{ flex: 1 }}>
        {placeholder}
      </UiText>
    </Pressable>
  );
}

function ToolTiles({ onOpenTool }: { onOpenTool: (toolId: ToolId) => void }) {
  const ui = useUi();
  const tx = useTx();
  const surface = useAppTheme().colors.surface;
  const { width } = useWindowDimensions();
  const tileWidth = (width - 32 - GAP * 2) / 3;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP, padding: 16 }}>
      {TILES.map((tile) => {
        const label = tx(tile.en, tile.hi);
        return (
          <Pressable
            key={tile.id}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onOpenTool(tile.id)}
            android_ripple={{ color: ui.fill }}
            style={{
              width: tileWidth,
              height: 96,
              borderRadius: uiRadius.tile,
              backgroundColor: surface,
              borderWidth: 1,
              borderColor: ui.ring,
              elevation: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingHorizontal: 4,
            }}
          >
            <Icon name={tile.icon} size={30} color={ui.category[tile.color]} />
            <UiText variant="label" color={ui.ink} numberOfLines={1}>
              {label}
            </UiText>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  const ui = useUi();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 8,
      }}
    >
      <UiText variant="section" accessibilityRole="header">
        {title}
      </UiText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action}
        onPress={onAction}
        style={{ minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' }}
      >
        <UiText variant="label" color={ui.brandOnSurface}>
          {action}
        </UiText>
      </Pressable>
    </View>
  );
}

function RecentThumbnails({
  files,
  onOpenFile,
}: {
  files: RecentFile[];
  onOpenFile: (file: RecentFile) => void;
}) {
  const ui = useUi();
  const tx = useTx();
  const surface = useAppTheme().colors.surface;
  if (files.length === 0) {
    return (
      <UiText
        variant="meta"
        color={ui.inkSecondary}
        style={{ paddingHorizontal: 16, paddingVertical: 12 }}
      >
        {tx('Your recent PDFs show here', 'आपकी हाल की PDF यहाँ दिखेंगी')}
      </UiText>
    );
  }
  return (
    <FlatList
      horizontal
      data={files}
      keyExtractor={(file) => file.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 16 }}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx(`Open ${item.name}`, `${item.name} खोलें`)}
          onPress={() => onOpenFile(item)}
          style={{ width: THUMB_W, gap: 8 }}
        >
          {item.thumbnailUri ? (
            <Image
              source={{ uri: item.thumbnailUri }}
              style={{
                width: THUMB_W,
                height: THUMB_H,
                borderRadius: 8,
                backgroundColor: surface,
                borderWidth: 1,
                borderColor: ui.ring,
              }}
            />
          ) : (
            <View
              style={{
                width: THUMB_W,
                height: THUMB_H,
                borderRadius: 8,
                backgroundColor: surface,
                borderWidth: 1,
                borderColor: ui.ring,
              }}
            />
          )}
          <UiText variant="meta" numberOfLines={1}>
            {item.name}
          </UiText>
        </Pressable>
      )}
    />
  );
}

/** Home tab: brand band with search, six tool tiles, and recent files. */
export function HomeScreen({ onOpenTool, onOpenFile, onSeeAll, onOpenSearch }: Props) {
  const tx = useTx();
  const recentFiles = useRecentFilesStore((state) => state.files);
  const [aboutVisible, setAboutVisible] = useState(false);
  const band = useBandCollapse();

  return (
    <>
      <BrandBand
        title={tx('Hindi PDF', 'हिंदी PDF')}
        scrollY={band.scrollY}
        leading={<AppMark />}
        actions={
          <BandIconButton
            icon="more-vert"
            label={tx('More options', 'और विकल्प')}
            onPress={() => setAboutVisible(true)}
          />
        }
        bandExtra={
          <SearchPill
            placeholder={tx('Search your PDFs', 'अपनी PDF खोजें')}
            onPress={onOpenSearch}
          />
        }
      >
        <ScrollView
          contentContainerStyle={{ paddingTop: 8, paddingBottom: NAV_CLEARANCE }}
          onScroll={band.onScroll}
          scrollEventThrottle={band.scrollEventThrottle}
        >
          <UiText variant="section" style={{ paddingHorizontal: 16 }} accessibilityRole="header">
            {tx('Tools', 'टूल')}
          </UiText>
          <ToolTiles onOpenTool={onOpenTool} />
          <SectionHeader
            title={tx('Recent files', 'हाल की फ़ाइलें')}
            action={tx('See all', 'सभी देखें')}
            onAction={onSeeAll}
          />
          <RecentThumbnails files={recentFiles} onOpenFile={onOpenFile} />
        </ScrollView>
      </BrandBand>
      <AboutModal visible={aboutVisible} onClose={() => setAboutVisible(false)} />
    </>
  );
}
