import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { useTx } from '../i18n';
import { formatFileSize, percentSmaller } from '../lib/fileSize';
import { renderPage } from '../lib/pdfToImages';
import { Icon } from '../ui/Icon';
import { PillButton } from '../ui/PillButton';
import { ToolScaffold } from '../ui/ToolScaffold';
import { UiText } from '../ui/UiText';
import { pagesLabel } from './tools/toolText';

const PREVIEW_WIDTH = 160;
const PREVIEW_HEIGHT = 226;
const BADGE_SIZE = 48;

/**
 * "Saved" screen every file tool shows once its output has passed the parse-back check (never
 * before). Shows a 160x226dp first-page preview with a green check badge, the file name,
 * `pages · size`, and where the file is: in this app's own storage (`persistOutput`), reachable
 * here through Open, Share and the Reader's Open with. Open and Share sit in the action bar;
 * Close and Android back call `onClose`. `onSaveCopy` adds a text button that copies the file to
 * a folder the person picks.
 * `sizeChange` adds a `before → after · n% smaller` line; `note` adds a grey note box.
 */
export function ToolDoneScreen({
  title,
  fileName,
  fileUri,
  pageCount,
  sizeBytes,
  previewUri,
  onOpen,
  onShare,
  onClose,
  onSaveCopy,
  sizeChange,
  note,
}: {
  title: string;
  fileName: string;
  fileUri: string;
  /** Pages in the saved file. */
  pageCount: number;
  /** Size of the saved file, in bytes. */
  sizeBytes: number;
  previewUri?: string;
  onOpen: () => void;
  onShare: () => void;
  onClose: () => void;
  onSaveCopy?: () => void;
  /** Source and output sizes, in bytes, for tools that change the file size. */
  sizeChange?: { fromBytes: number; toBytes: number };
  note?: string;
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const tx = useTx();
  const [renderedPreview, setRenderedPreview] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (previewUri) return;
    let active = true;
    renderPage(fileUri, 0, 1)
      .then((image) => {
        if (active) setRenderedPreview(image.uri);
      })
      .catch(() => {
        // The preview is decorative; the page outline stays when it cannot render.
      });
    return () => {
      active = false;
    };
  }, [fileUri, previewUri]);

  const preview = previewUri ?? renderedPreview;
  const meta = `${pagesLabel(tx, pageCount)} · ${formatFileSize(sizeBytes)}`;
  const smaller = sizeChange ? percentSmaller(sizeChange.fromBytes, sizeChange.toBytes) : 0;
  const sizeLine = sizeChange
    ? `${formatFileSize(sizeChange.fromBytes)} → ${formatFileSize(sizeChange.toBytes)}` +
      (smaller > 0 ? ` · ${tx(`${smaller}% smaller`, `${smaller}% छोटी`)}` : '')
    : null;

  return (
    <ToolScaffold
      title={title}
      leadingIcon="close"
      onLeading={onClose}
      primary={{ title: tx('Open', 'खोलें'), onPress: onOpen }}
      secondary={{ title: tx('Share', 'शेयर करें'), onPress: onShare }}
    >
      <View style={{ paddingTop: 32, paddingHorizontal: 24, alignItems: 'center' }}>
        <View>
          <View
            style={{
              width: PREVIEW_WIDTH,
              height: PREVIEW_HEIGHT,
              borderRadius: 6,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: ui.ring,
              elevation: 4,
              overflow: 'hidden',
            }}
          >
            {preview ? (
              <Image
                source={{ uri: preview }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            ) : null}
          </View>
          <View
            style={{
              position: 'absolute',
              right: -14,
              bottom: -14,
              width: BADGE_SIZE + 10,
              height: BADGE_SIZE + 10,
              borderRadius: 9999,
              backgroundColor: theme.colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 5,
            }}
          >
            <View
              style={{
                width: BADGE_SIZE,
                height: BADGE_SIZE,
                borderRadius: 9999,
                backgroundColor: ui.success,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="check" size={28} color="#FFFFFF" />
            </View>
          </View>
        </View>
        <UiText
          accessibilityRole="header"
          style={{ marginTop: 32, fontSize: 26, fontWeight: '600', textAlign: 'center' }}
        >
          {tx('Saved', 'सेव हो गई')}
        </UiText>
        <UiText variant="body" style={{ marginTop: 8, textAlign: 'center' }} numberOfLines={2}>
          {fileName}
        </UiText>
        <UiText
          variant="meta"
          color={ui.inkSecondary}
          style={{ marginTop: 4, textAlign: 'center' }}
        >
          {meta}
        </UiText>
        {sizeLine ? (
          <UiText
            variant="meta"
            color={ui.inkSecondary}
            style={{ marginTop: 4, textAlign: 'center' }}
          >
            {sizeLine}
          </UiText>
        ) : null}
        <UiText
          variant="meta"
          color={ui.inkSecondary}
          style={{ marginTop: 12, textAlign: 'center' }}
        >
          {tx(
            'Saved in this app and listed in Files. Use Share, or Open with in the Reader, to use it in another app.',
            'इस ऐप में सेव है और फ़ाइलें में दिखेगी। दूसरे ऐप में इस्तेमाल के लिए शेयर करें, या रीडर में इससे खोलें चुनें।',
          )}
        </UiText>
        {note ? (
          <View
            style={{
              marginTop: 16,
              alignSelf: 'stretch',
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: ui.fill,
            }}
          >
            <UiText variant="meta" color={ui.inkLabel}>
              {note}
            </UiText>
          </View>
        ) : null}
        {onSaveCopy ? (
          <View style={{ marginTop: 16 }}>
            <PillButton
              kind="text"
              icon="drive-folder-upload"
              title={tx('Save a copy to a folder', 'किसी फ़ोल्डर में कॉपी सेव करें')}
              onPress={onSaveCopy}
            />
          </View>
        ) : null}
      </View>
    </ToolScaffold>
  );
}
