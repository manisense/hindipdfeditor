import { Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import { clampToPage, resizeKeepingAspect, type PageRect } from '../lib/imagePlacement';
import type { ImageEdit } from '../state/editStore';
import './ImageEditOverlay.css';

type Props = {
  edit: ImageEdit;
  viewWidthPx: number;
  pageWidthPt: number;
  pageHeightPt: number;
  selected: boolean;
  /** Whether the image takes pointer input (off while a box tool is drawing). */
  interactive: boolean;
  label: string;
  deleteLabel: string;
  resizeLabel: string;
  onSelect: () => void;
  /** Commits a move or resize, in PDF points. */
  onChange: (rect: PageRect) => void;
  onDelete: () => void;
};

type Gesture = { kind: 'move' | 'resize'; startX: number; startY: number; start: PageRect; moved: boolean };

/** Arrow-key step, in PDF points (Shift: 10×). */
const KEY_STEP_PT = 1;
/** Pointer travel below which a press is a selection, not a move, in screen px. */
const MOVE_SLOP_PX = 3;

/** An inserted image or signature on the page: drag to move, corner handle to resize. */
export function ImageEditOverlay({
  edit,
  viewWidthPx,
  pageWidthPt,
  pageHeightPt,
  selected,
  interactive,
  label,
  deleteLabel,
  resizeLabel,
  onSelect,
  onChange,
  onDelete,
}: Props) {
  const gestureRef = useRef<Gesture | null>(null);
  const [draft, setDraft] = useState<PageRect | null>(null);
  const rect = draft ?? edit;
  const ptPerPx = pageWidthPt / Math.max(1, viewWidthPx);
  const { xDp, yDp } = ptToDp(rect.xPt, rect.yPt, viewWidthPx, pageWidthPt);
  const { wDp, hDp } = ptSizeToDp(rect.wPt, rect.hPt, viewWidthPx, pageWidthPt);

  const begin = (kind: Gesture['kind']) => (event: React.PointerEvent) => {
    if (!interactive) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    gestureRef.current = { kind, startX: event.clientX, startY: event.clientY, start: edit, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const move = (event: React.PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) < MOVE_SLOP_PX) return;
    gesture.moved = true;
    setDraft(
      gesture.kind === 'move'
        ? clampToPage(
            { ...gesture.start, xPt: gesture.start.xPt + dx * ptPerPx, yPt: gesture.start.yPt + dy * ptPerPx },
            pageWidthPt,
            pageHeightPt,
          )
        : resizeKeepingAspect(gesture.start, gesture.start.wPt + dx * ptPerPx, pageWidthPt, pageHeightPt),
    );
  };

  const end = (event: React.PointerEvent) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    event.stopPropagation();
    gestureRef.current = null;
    if (gesture.moved && draft) onChange(draft);
    setDraft(null);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onDelete();
      return;
    }
    const step = KEY_STEP_PT * (event.shiftKey ? 10 : 1);
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    onChange(clampToPage({ ...edit, xPt: edit.xPt + d[0], yPt: edit.yPt + d[1] }, pageWidthPt, pageHeightPt));
  };

  return (
    <div
      data-edit-id={edit.id}
      className={`image-edit-overlay${selected ? ' image-edit-overlay--selected' : ''}${interactive ? '' : ' image-edit-overlay--inert'}`}
      style={{ left: xDp, top: yDp, width: wDp, height: hDp }}
      role="group"
      aria-label={label}
      tabIndex={interactive ? 0 : -1}
      onFocus={onSelect}
      onKeyDown={onKeyDown}
      onPointerDown={begin('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={(event) => event.stopPropagation()}
    >
      <img className="image-edit-overlay__image" src={edit.uri} alt="" draggable={false} />
      {selected && interactive && (
        <>
          <button
            type="button"
            className="image-edit-overlay__delete"
            aria-label={deleteLabel}
            title={deleteLabel}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
          <span
            className="image-edit-overlay__handle"
            aria-label={resizeLabel}
            title={resizeLabel}
            onPointerDown={begin('resize')}
          />
        </>
      )}
    </div>
  );
}
