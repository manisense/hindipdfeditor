import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { useUi } from '../../hooks/useAppTheme';
import { useIsHindi, useTx } from '../../i18n';
import { formatFileSize } from '../../lib/fileSize';
import type { RecentFile } from '../../state/recentFilesStore';
import { BottomSheet } from '../../ui/BottomSheet';
import { UiText } from '../../ui/UiText';

/** Size (bytes) and modified time (epoch ms) read from the file system when the entry lacks them. */
type FsDetails = { sizeBytes?: number; modifiedMs?: number };

/** Folder name from the entry, or the parent folder of its path. */
function folderOf(file: RecentFile): string | undefined {
  if (file.folder) return file.folder;
  return file.path?.split('/').slice(-2, -1)[0] || undefined;
}

/**
 * Bottom sheet with the opened file's Name, Pages, Size, Folder and Modified rows. A row is shown
 * only when its value is known; missing size and modified time are read from the file system.
 * `pageCount` is the page count the Reader loaded.
 */
export function FileInfoSheet({
  visible,
  onClose,
  file,
  pageCount,
}: {
  visible: boolean;
  onClose: () => void;
  file: RecentFile;
  pageCount: number;
}) {
  const ui = useUi();
  const tx = useTx();
  const hindi = useIsHindi();
  const [fsDetails, setFsDetails] = useState<FsDetails>({});

  const needsFs = !(file.sizeBytes > 0) || file.dateModified === undefined;
  useEffect(() => {
    if (!visible || !needsFs) return;
    let active = true;
    FileSystem.getInfoAsync(file.uri)
      .then((info) => {
        if (!active || !info.exists) return;
        setFsDetails({
          sizeBytes: info.size,
          // `modificationTime` is in epoch seconds.
          modifiedMs: info.modificationTime ? info.modificationTime * 1000 : undefined,
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [visible, needsFs, file.uri]);

  const sizeBytes = file.sizeBytes > 0 ? file.sizeBytes : fsDetails.sizeBytes;
  const modifiedMs = file.dateModified ?? fsDetails.modifiedMs;
  const folder = folderOf(file);

  const rows: { label: string; value: string | undefined }[] = [
    { label: tx('Name', 'नाम'), value: file.name },
    { label: tx('Pages', 'पृष्ठ'), value: pageCount > 0 ? String(pageCount) : undefined },
    {
      label: tx('Size', 'साइज़'),
      value: sizeBytes && sizeBytes > 0 ? formatFileSize(sizeBytes) : undefined,
    },
    { label: tx('Folder', 'फ़ोल्डर'), value: folder },
    {
      label: tx('Modified', 'बदली गई'),
      value: modifiedMs
        ? new Date(modifiedMs).toLocaleDateString(hindi ? 'hi-IN' : 'en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : undefined,
    },
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={tx('File info', 'फ़ाइल की जानकारी')}>
      <View style={{ paddingTop: 8 }}>
        {rows.map((row) =>
          row.value ? (
            <View
              key={row.label}
              accessible
              accessibilityLabel={`${row.label}, ${row.value}`}
              style={{
                minHeight: 64,
                paddingHorizontal: 24,
                paddingVertical: 10,
                justifyContent: 'center',
              }}
            >
              <UiText variant="meta" color={ui.inkSecondary}>
                {row.label}
              </UiText>
              <UiText variant="body" selectable>
                {row.value}
              </UiText>
            </View>
          ) : null,
        )}
      </View>
    </BottomSheet>
  );
}
