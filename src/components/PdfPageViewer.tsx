import { useState, type ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { dpToPt } from '../lib/coordinateMath';
import type { PageState } from '../state/editStore';

type Props = {
  page: PageState;
  /** Called with the tapped position converted to PDF points, page-relative (spec Section 8). */
  onTap: (xPt: number, yPt: number) => void;
  /**
   * When true, the page `Pressable` does not handle taps — a child overlay (e.g. `MaskOverlay`'s
   * `onShortTap`) owns the tap pipeline so `onTap` is not fired twice.
   */
  disablePress?: boolean;
  /**
   * Renders overlay elements (e.g. `EditableTextOverlay`) on top of the background image,
   * given the view's currently measured width in dp - callers need this to convert a stored
   * edit's position (points) back to dp via `coordinateMath.ts`'s `ptToDp`, using the same
   * width this component used to convert the tap that created it.
   */
  renderOverlays?: (viewWidthDp: number) => ReactNode;
};

/**
 * Displays a page's rasterized background image (`pdfToImages.ts`'s output, a JPEG) at the view's
 * measured on-screen width (dp), scaled to the image's real aspect ratio, and converts taps
 * into PDF-point coordinates via `coordinateMath.ts` - spec Section 6/8. This is the only
 * component that reads `PageState.backgroundImageUri`; overlay positioning is delegated back
 * to the caller via `renderOverlays` so this component stays single-purpose (display + tap),
 * not also responsible for edit rendering.
 */
export function PdfPageViewer({ page, onTap, disablePress, renderOverlays }: Props) {
  const [viewWidthDp, setViewWidthDp] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setViewWidthDp(event.nativeEvent.layout.width);
  };

  const handlePress = (event: GestureResponderEvent) => {
    if (viewWidthDp === 0) {
      return;
    }
    const { locationX, locationY } = event.nativeEvent;
    const { xPt, yPt } = dpToPt(locationX, locationY, viewWidthDp, page.widthPt);
    onTap(xPt, yPt);
  };

  const heightDp = viewWidthDp > 0 ? viewWidthDp * (page.imagePxHeight / page.imagePxWidth) : 0;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {viewWidthDp > 0 && (
        <Pressable
          onPress={disablePress ? undefined : handlePress}
          style={[styles.pageArea, { width: viewWidthDp, height: heightDp }]}
        >
          <Image
            source={{ uri: page.backgroundImageUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="stretch"
          />
          {renderOverlays?.(viewWidthDp)}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  pageArea: {
    position: 'relative',
  },
});
