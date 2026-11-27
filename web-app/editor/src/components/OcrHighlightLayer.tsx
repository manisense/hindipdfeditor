import { useEffect, useRef } from 'react';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import type { OcrLine } from '../state/editStore';
import './OcrHighlightLayer.css';

type Props = {
  lines: OcrLine[];
  viewWidthPx: number;
  pageWidthPt: number;
  visible?: boolean;
  /** The line being checked (see `LineCheckPanel`): outlined and scrolled into view. */
  activeLineId?: string;
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
  activeLineId,
}: Props) {
  const activeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
  }, [activeLineId]);
  if (!visible || lines.length === 0) return null;

  return (
    <div className="ocr-highlight-layer" aria-hidden="true">
      {lines.map((line) => {
        const { xDp, yDp } = ptToDp(line.xPt, line.yPt, viewWidthPx, pageWidthPt);
        const { wDp, hDp } = ptSizeToDp(line.wPt, line.hPt, viewWidthPx, pageWidthPt);
        return (
          <div
            key={line.id}
            ref={line.id === activeLineId ? activeRef : undefined}
            className={`ocr-highlight-layer__box${line.id === activeLineId ? ' ocr-highlight-layer__box--active' : ''}`}
            style={{ left: xDp, top: yDp, width: wDp, height: hDp }}
            title={line.text}
          />
        );
      })}
    </div>
  );
}
