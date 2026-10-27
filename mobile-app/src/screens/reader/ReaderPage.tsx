import { memo } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';

import { useTx } from '../../i18n';
import { Icon } from '../../ui/Icon';
import { ui } from '../../ui/tokens';
import { UiText } from '../../ui/UiText';

/**
 * One page in the Reader list, `width` x `height` dp on white. Shows the rendered image when
 * `uri` is set, a spinner while it renders, and a notice when the render `failed`. `wash` is an
 * optional colour laid over the image for the reading theme. Pages are always white, so the
 * light tokens are used in both app themes. Taps come from the zoomable page around it; `onPress`
 * is the screen-reader activation.
 */
export const ReaderPage = memo(function ReaderPage({
  page,
  pageCount,
  width,
  height,
  uri,
  failed,
  wash,
  onPress,
}: {
  /** Zero-based page index. */
  page: number;
  pageCount: number;
  width: number;
  height: number;
  uri?: string;
  failed: boolean;
  wash?: string;
  onPress: () => void;
}) {
  const tx = useTx();
  return (
    <View
      accessible
      accessibilityRole="imagebutton"
      accessibilityLabel={tx(
        `Page ${page + 1} of ${pageCount}`,
        `पृष्ठ ${page + 1} / ${pageCount}`,
      )}
      accessibilityHint={tx('Shows or hides the controls', 'कंट्रोल दिखाता या छिपाता है')}
      onAccessibilityTap={onPress}
      style={{ width, height, backgroundColor: '#FFFFFF' }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {failed ? (
            <>
              <Icon name="broken-image" size={32} color={ui.inkTertiary} />
              <UiText variant="meta" color={ui.inkTertiary}>
                {tx("Couldn't show this page", 'यह पृष्ठ नहीं दिख सका')}
              </UiText>
            </>
          ) : (
            <ActivityIndicator color={ui.brand} />
          )}
        </View>
      )}
      {wash ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: wash,
          }}
        />
      ) : null}
    </View>
  );
});
