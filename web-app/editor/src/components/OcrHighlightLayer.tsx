import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import type { OcrLine } from '../state/editStore';
import './OcrHighlightLayer.css';

type Props = {
  lines: OcrLine[];
  viewWidthPx: number;
  pageWidthPt: number;
  visible?: boolean;
};

/**
 * Faint boxes over OCR / embedded-text targets so users can see what is tappable.
 * `pointer-events: none` — taps still go to `PdfPageViewer`.
 */
export function OcrHighlightLayer({
  lines,
  viewWidthPx,
  pageWidthPt,
  visible = true,
}: Props) {
  if (!visible || lines.length === 0) return null;

  return (
    <div className="ocr-highlight-layer" aria-hidden="true">
      {lines.map((line) => {
        const { xDp, yDp } = ptToDp(line.xPt, line.yPt, viewWidthPx, pageWidthPt);
        const { wDp, hDp } = ptSizeToDp(line.wPt, line.hPt, viewWidthPx, pageWidthPt);
        return (
          <div
            key={line.id}
            className="ocr-highlight-layer__box"
            style={{ left: xDp, top: yDp, width: wDp, height: hDp }}
            title={line.text}
          />
        );
      })}
    </div>
  );
}
