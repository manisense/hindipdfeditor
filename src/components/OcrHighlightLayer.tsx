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
};

/**
 * Purely visual layer marking where OCR detected existing text, so the user can see what's
 * tappable for in-place editing. Deliberately renders with `pointerEvents="none"` and handles
 * no gestures at all: the actual tap is `PdfPageViewer`'s existing `onTap`, hit-tested against
 * the same `OcrLine` boxes in `App.tsx` (`ocrHitTest.ts`) - one tap pipeline, not two racing
 * gesture layers (the same reason Phase 3 chose a mode toggle over a long-press).
 */
export function OcrHighlightLayer({ lines, viewWidthDp, pageWidthPt }: Props) {
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
    borderColor: 'rgba(26, 115, 232, 0.55)',
    backgroundColor: 'rgba(26, 115, 232, 0.08)',
    borderRadius: 2,
  },
});
