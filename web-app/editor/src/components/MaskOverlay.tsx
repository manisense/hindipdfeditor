import { X } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';

import { dpSizeToPt, dpToPt, ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import { isBoxDrag } from '../lib/dragIntent';
import type { MaskEdit } from '../state/editStore';
import './MaskOverlay.css';

export type DrawnMaskRect = { xPt: number; yPt: number; wPt: number; hPt: number };

type Props = {
  masks: MaskEdit[];
  viewWidthPx: number;
  pageWidthPt: number;
  active: boolean;
  onMaskDrawn: (rect: DrawnMaskRect) => void;
  /** Fired when the user clicks/taps without dragging a real erase box (cancel erase mode). */
  onCancel?: () => void;
  /** Look of the box being dragged: the Highlight tool previews its colour. */
  drawKind?: 'highlight';
  /** Masks of this kind show a remove button (while their tool is selected). */
  removableKind?: 'whiteout' | 'highlight';
  /** Accessible name of the remove button. */
  removeLabel?: string;
  onRemove?: (id: string) => void;
};

const kindOf = (mask: MaskEdit) => mask.kind ?? 'whiteout';

export function MaskOverlay({
  masks,
  viewWidthPx,
  pageWidthPt,
  active,
  onMaskDrawn,
  onCancel,
  drawKind,
  removableKind,
  removeLabel,
  onRemove,
}: Props) {
  const [dragRectPx, setDragRectPx] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!active) return;
    event.preventDefault();
    event.stopPropagation();
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
    if (!rect || viewWidthPx === 0) {
      onCancel?.();
      return;
    }
    if (!isBoxDrag(rect.w, rect.h)) {
      onCancel?.();
      return;
    }
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
      {/* Highlights are drawn last, over whiteouts, as the export draws them. */}
      {[...masks.filter((m) => kindOf(m) !== 'highlight'), ...masks.filter((m) => kindOf(m) === 'highlight')].map((mask) => {
        const { xDp, yDp } = ptToDp(mask.xPt, mask.yPt, viewWidthPx, pageWidthPt);
        const { wDp, hDp } = ptSizeToDp(mask.wPt, mask.hPt, viewWidthPx, pageWidthPt);
        const kind = kindOf(mask);
        return (
          <Fragment key={mask.id}>
            <div
              className={`mask-overlay__mask mask-overlay__mask--${kind}`}
              style={{
                left: xDp,
                top: yDp,
                width: wDp,
                height: hDp,
                backgroundColor: mask.color,
                ...(mask.previewUri
                  ? { backgroundImage: `url(${mask.previewUri})`, backgroundSize: '100% 100%' }
                  : {}),
              }}
            />
            {active && onRemove && removableKind === kind && (
              <button
                type="button"
                className="mask-overlay__remove"
                style={{ left: xDp + wDp - 12, top: yDp - 12 }}
                aria-label={removeLabel}
                title={removeLabel}
                onPointerDown={(event) => event.stopPropagation()}
                onPointerUp={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(mask.id);
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </Fragment>
        );
      })}
      {dragRectPx && (
        <div
          className={`mask-overlay__drag${drawKind ? ` mask-overlay__drag--${drawKind}` : ''}`}
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
