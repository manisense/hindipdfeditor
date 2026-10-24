import { Image, Pressable, View } from 'react-native';

import { useAppTheme, useUi } from '../../hooks/useAppTheme';
import { useIsHindi, useTx } from '../../i18n';
import { formatFileSize } from '../../lib/fileSize';
import { fileTimeMs } from '../../lib/fileTimes';
import type { RecentFile } from '../../state/recentFilesStore';
import { Icon } from '../../ui/Icon';
import { UiText } from '../../ui/UiText';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const STAR_COLOR = '#C2560A';

function formatRelativeTime(
  timeMs: number,
  nowMs: number,
  tx: (en: string, hi: string) => string,
  hindi: boolean,
): string | null {
  if (Number.isNaN(timeMs)) return null;
  const age = Math.max(0, nowMs - timeMs);
  if (age < MINUTE_MS) return tx('Just now', 'अभी');
  if (age < HOUR_MS) {
    const m = Math.floor(age / MINUTE_MS);
    return tx(`${m} min ago`, `${m} मिनट पहले`);
  }
  if (age < DAY_MS) {
    const h = Math.floor(age / HOUR_MS);
    return tx(`${h} h ago`, `${h} घंटे पहले`);
  }
  if (age < 2 * DAY_MS) return tx('Yesterday', 'कल');
  if (age < 7 * DAY_MS) {
    const d = Math.floor(age / DAY_MS);
    return tx(`${d} days ago`, `${d} दिन पहले`);
  }
  return new Date(timeMs).toLocaleDateString(hindi ? 'hi-IN' : 'en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** 72dp file row: 40x56 thumbnail, name, meta line, star toggle and a more button. */
export function FileRow({
  file,
  thumbUri,
  pageCount,
  nowMs,
  onOpen,
  onToggleStar,
  onMore,
}: {
  file: RecentFile;
  thumbUri?: string;
  pageCount: number;
  nowMs: number;
  onOpen: () => void;
  onToggleStar: () => void;
  onMore: () => void;
}) {
  const ui = useUi();
  const surface = useAppTheme().colors.surface;
  const tx = useTx();
  const hindi = useIsHindi();
  const time = formatRelativeTime(fileTimeMs(file), nowMs, tx, hindi) ?? file.date;
  const pages =
    pageCount === 1 ? tx('1 page', '1 पृष्ठ') : tx(`${pageCount} pages`, `${pageCount} पृष्ठ`);
  const meta = [formatFileSize(file.sizeBytes), pages, time].join(' · ');
  const thumbStyle = {
    width: 40,
    height: 56,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: ui.ring,
    backgroundColor: surface,
  };

  return (
    <View style={{ height: 72, flexDirection: 'row', alignItems: 'center', paddingRight: 4 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx(`Open ${file.name}, ${meta}`, `${file.name} खोलें, ${meta}`)}
        onPress={onOpen}
        android_ripple={{ color: ui.fill }}
        style={{
          flex: 1,
          height: 72,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          paddingLeft: 16,
        }}
      >
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={thumbStyle} resizeMode="cover" />
        ) : (
          <View style={[thumbStyle, { alignItems: 'center', justifyContent: 'center' }]}>
            <Icon name="picture-as-pdf" size={20} color={ui.inkTertiary} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <UiText variant="body" numberOfLines={1}>
            {file.name}
          </UiText>
          <UiText variant="meta" color={ui.inkSecondary} numberOfLines={1}>
            {meta}
          </UiText>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          file.starred ? tx('Remove star', 'स्टार हटाएँ') : tx('Star', 'स्टार करें')
        }
        accessibilityState={{ selected: !!file.starred }}
        onPress={onToggleStar}
        android_ripple={{ color: ui.fill, borderless: true, radius: 24 }}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon
          name={file.starred ? 'star' : 'star-border'}
          size={24}
          color={file.starred ? STAR_COLOR : ui.inkTertiary}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx(`More options for ${file.name}`, `${file.name} के और विकल्प`)}
        onPress={onMore}
        android_ripple={{ color: ui.fill, borderless: true, radius: 24 }}
        style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon name="more-vert" size={24} color={ui.inkSecondary} />
      </Pressable>
    </View>
  );
}
