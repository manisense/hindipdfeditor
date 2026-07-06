import { StyleSheet, View } from 'react-native';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import type { OcrLine } from '../state/editStore';

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
};

/**
 * Optional visual layer for OCR-detected text. Deliberately invisible by default so the page
 * looks like a normal document until the user taps text (Canva-style). Renders with
 * `pointerEvents="none"` - taps go through to `PdfPageViewer`'s `onTap`, hit-tested in
 * `App.tsx` via `ocrHitTest.ts`.
 */
export function OcrHighlightLayer({ lines, viewWidthDp, pageWidthPt, visible = false }: Props) {
  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map((line) => {
        const { xDp, yDp } = ptToDp(line.xPt, line.yPt, viewWidthDp, pageWidthPt);
        const { wDp, hDp } = ptSizeToDp(line.wPt, line.hPt, viewWidthDp, pageWidthPt);
        return (
          <View
            key={line.id}
            style={[styles.highlight, { left: xDp, top: yDp, width: wDp, height: hDp }]}
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
});
