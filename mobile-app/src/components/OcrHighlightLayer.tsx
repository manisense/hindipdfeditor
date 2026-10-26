import { StyleSheet, View } from 'react-native';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import type { OcrLine } from '../state/editStore';
import { ui } from '../ui/tokens';

type Props = {
  /** Detected-but-not-yet-edited text lines on this page, boxes in PDF points. */
  lines: OcrLine[];
  /** The `PdfPageViewer`'s currently measured width, in dp - see that component's docstring. */
  viewWidthDp: number;
  /** The source page's width, in PDF points. */
  pageWidthPt: number;
  /**
   * When true, shows faint boxes so the user can see what's tappable (debug/onboarding).
   * Default false for a clean Canva-like canvas - hit-testing still works in `App.tsx`.
   */
  visible?: boolean;
  /**
   * `'search'` fills each box with the brand tint (multiplied, so text stays readable) and the
   * box whose id is `currentId` with the brand colour at 30%. Default `'outline'`.
   */
  tone?: 'outline' | 'search';
  /** Id of the line to emphasise in the `'search'` tone. */
  currentId?: string;
};

/**
 * Optional visual layer for OCR-detected text. Deliberately invisible by default so the page
 * looks like a normal document until the user taps text (Canva-style). Renders with
 * `pointerEvents="none"` - taps go through to `PdfPageViewer`'s `onTap`, hit-tested in
 * `App.tsx` via `ocrHitTest.ts`.
 */
export function OcrHighlightLayer({
  lines,
  viewWidthDp,
  pageWidthPt,
  visible = false,
  tone = 'outline',
  currentId,
}: Props) {
  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((line) => {
        const { xDp, yDp } = ptToDp(line.xPt, line.yPt, viewWidthDp, pageWidthPt);
        const { wDp, hDp } = ptSizeToDp(line.wPt, line.hPt, viewWidthDp, pageWidthPt);
        return (
          <View
            key={line.id}
            style={[
              tone === 'search'
                ? line.id === currentId
                  ? styles.current
                  : styles.match
                : styles.highlight,
              { left: xDp, top: yDp, width: wDp, height: hDp },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  highlight: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(36, 83, 178, 0.35)',
    backgroundColor: 'rgba(36, 83, 178, 0.06)',
    borderRadius: 2,
  },
  // Pages are always white, so the light tokens are used in both app themes.
  match: {
    position: 'absolute',
    backgroundColor: ui.brandTint,
    mixBlendMode: 'multiply',
    borderRadius: 2,
  },
  current: {
    position: 'absolute',
    backgroundColor: ui.brand,
    opacity: 0.3,
    borderRadius: 2,
  },
});
