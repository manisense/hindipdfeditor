import { useRef, useState } from 'react';

import { dpSizeToPt, dpToPt, ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import type { MaskEdit } from '../state/editStore';
import './MaskOverlay.css';

export type DrawnMaskRect = { xPt: number; yPt: number; wPt: number; hPt: number };

type Props = {
  masks: MaskEdit[];
  viewWidthPx: number;
  pageWidthPt: number;
  active: boolean;
  onMaskDrawn: (rect: DrawnMaskRect) => void;
};

const MIN_DRAG_PX = 12;

export function MaskOverlay({ masks, viewWidthPx, pageWidthPt, active, onMaskDrawn }: Props) {
  const [dragRectPx, setDragRectPx] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!active) return;
    event.preventDefault();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    dragStartRef.current = { x, y };
    setDragRectPx({ x, y, w: 0, h: 0 });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!active || !dragStartRef.current) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const start = dragStartRef.current;
    setDragRectPx({
      x: Math.min(start.x, x),
      y: Math.min(start.y, y),
      w: Math.abs(x - start.x),
      h: Math.abs(y - start.y),
    });
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!active) return;
    const rect = dragRectPx;
    dragStartRef.current = null;
    setDragRectPx(null);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (!rect || viewWidthPx === 0) return;
    if (rect.w < MIN_DRAG_PX || rect.h < MIN_DRAG_PX) return;
    const { xPt, yPt } = dpToPt(rect.x, rect.y, viewWidthPx, pageWidthPt);
    const { wPt, hPt } = dpSizeToPt(rect.w, rect.h, viewWidthPx, pageWidthPt);
    onMaskDrawn({ xPt, yPt, wPt, hPt });
  };

  return (
    <div
      className={`mask-overlay ${active ? 'mask-overlay--active' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {masks.map((mask) => {
        const { xDp, yDp } = ptToDp(mask.xPt, mask.yPt, viewWidthPx, pageWidthPt);
        const { wDp, hDp } = ptSizeToDp(mask.wPt, mask.hPt, viewWidthPx, pageWidthPt);
        return (
          <div
            key={mask.id}
            className="mask-overlay__mask"
            style={{
              left: xDp,
              top: yDp,
              width: wDp,
              height: hDp,
              backgroundColor: mask.color,
            }}
          />
        );
      })}
      {dragRectPx && (
        <div
          className="mask-overlay__drag"
          style={{
            left: dragRectPx.x,
            top: dragRectPx.y,
            width: dragRectPx.w,
            height: dragRectPx.h,
          }}
        />
      )}
    </div>
  );
}
