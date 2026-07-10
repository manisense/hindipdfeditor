import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { dpToPt } from '../lib/coordinateMath';
import type { PageState } from '../state/editStore';
import './PdfPageViewer.css';

type Props = {
  page: PageState;
  onTap: (xPt: number, yPt: number) => void;
  disablePress?: boolean;
  renderOverlays?: (viewWidthPx: number) => ReactNode;
  focusedEditId?: string | null;
  onEditPinchStart?: (editId: string) => void;
  onEditPinchResize?: (editId: string, scale: number) => void;
  onEditPinchEnd?: () => void;
  onZoomChange?: (zoom: number) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const TAP_SLOP_PX = 8;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function PdfPageViewer({
  page,
  onTap,
  disablePress,
  renderOverlays,
  focusedEditId,
  onEditPinchStart,
  onEditPinchResize,
  onEditPinchEnd,
  onZoomChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewWidthPx, setViewWidthPx] = useState(0);
  const [zoom, setZoom] = useState(1);

  const zoomRef = useRef(zoom);
  const focusedEditIdRef = useRef(focusedEditId);
  const scrollOffsetRef = useRef({ x: 0, y: 0 });
  const pinchRef = useRef<{ mode: 'page' | 'edit' | null; startDist: number; startZoom: number }>({
    mode: null,
    startDist: 0,
    startZoom: 1,
  });
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);

  useEffect(() => {
    zoomRef.current = zoom;
    onZoomChange?.(zoom);
  }, [zoom, onZoomChange]);

  useEffect(() => {
    focusedEditIdRef.current = focusedEditId;
  }, [focusedEditId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewWidthPx(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const heightPx =
    viewWidthPx > 0 ? viewWidthPx * (page.imagePxHeight / page.imagePxWidth) : 0;

  const pageCoordsFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      const scroll = scrollRef.current;
      if (!container || !scroll || viewWidthPx <= 0) return { xPt: 0, yPt: 0 };
      const rect = scroll.getBoundingClientRect();
      const localX = clientX - rect.left + scroll.scrollLeft;
      const localY = clientY - rect.top + scroll.scrollTop;
      const xPx = localX / zoomRef.current;
      const yPx = localY / zoomRef.current;
      return dpToPt(xPx, yPx, viewWidthPx, page.widthPt);
    },
    [viewWidthPx, page.widthPt],
  );

  const pinchDistance = (touches: { length: number; 0?: Touch; 1?: Touch }) => {
    if (touches.length < 2) return 0;
    const a = touches[0];
    const b = touches[1];
    if (!a || !b) return 0;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    touchMovedRef.current = false;
    if (event.pointerType === 'touch') {
      const touches = (event.currentTarget as HTMLElement).parentElement?.querySelector(
        '.pdf-page-viewer__scroll',
      );
      void touches;
    }
    if ((event.currentTarget as HTMLElement).setPointerCapture) {
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    touchStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchMovedRef.current = false;
    if (event.touches.length === 1) {
      touchStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    if (event.touches.length === 2) {
      const dist = pinchDistance(event.touches);
      const editId = focusedEditIdRef.current;
      pinchRef.current = {
        mode: editId ? 'edit' : 'page',
        startDist: dist,
        startZoom: zoomRef.current,
      };
      if (editId) onEditPinchStart?.(editId);
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    const session = pinchRef.current;
    if (event.touches.length === 2 && session.mode) {
      touchMovedRef.current = true;
      const dist = pinchDistance(event.touches);
      if (session.startDist <= 0) return;
      const scale = dist / session.startDist;
      if (session.mode === 'page') {
        const newZoom = clamp(session.startZoom * scale, MIN_ZOOM, MAX_ZOOM);
        setZoom(newZoom);
      } else {
        const editId = focusedEditIdRef.current;
        if (editId) onEditPinchResize?.(editId, scale);
      }
      return;
    }
    const start = touchStartRef.current;
    if (start && event.touches.length === 1) {
      const moved = Math.hypot(
        event.touches[0].clientX - start.x,
        event.touches[0].clientY - start.y,
      );
      if (moved > TAP_SLOP_PX) touchMovedRef.current = true;
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (pinchRef.current.mode && event.touches.length < 2) {
      if (pinchRef.current.mode === 'edit') onEditPinchEnd?.();
      pinchRef.current = { mode: null, startDist: 0, startZoom: zoomRef.current };
    }
    if (event.touches.length > 0) return;
    if (!disablePress && !touchMovedRef.current && touchStartRef.current && viewWidthPx > 0) {
      const { x, y } = touchStartRef.current;
      const { xPt, yPt } = pageCoordsFromClient(x, y);
      onTap(xPt, yPt);
    }
    touchStartRef.current = null;
  };

  const handleClick = (event: React.MouseEvent) => {
    if (disablePress || touchMovedRef.current || viewWidthPx <= 0) return;
    const { xPt, yPt } = pageCoordsFromClient(event.clientX, event.clientY);
    onTap(xPt, yPt);
  };

  const handleWheel = (event: React.WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => clamp(z + delta, MIN_ZOOM, MAX_ZOOM));
  };

  return (
    <div
      ref={containerRef}
      className="pdf-page-viewer"
      style={{ height: heightPx > 0 ? heightPx : undefined }}
      onWheel={handleWheel}
    >
      {viewWidthPx > 0 && (
        <div
          ref={scrollRef}
          className="pdf-page-viewer__scroll"
          style={{ width: viewWidthPx, height: heightPx }}
          onScroll={(e) => {
            scrollOffsetRef.current = {
              x: e.currentTarget.scrollLeft,
              y: e.currentTarget.scrollTop,
            };
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          <div
            className="pdf-page-viewer__content"
            style={{
              width: viewWidthPx * zoom,
              height: heightPx * zoom,
            }}
          >
            <div
              className="pdf-page-viewer__page"
              style={{
                width: viewWidthPx,
                height: heightPx,
                transform: `scale(${zoom})`,
              }}
              onPointerDown={handlePointerDown}
            >
              <img
                src={page.backgroundImageUri}
                alt={`Page ${page.pageIndex + 1}`}
                className="pdf-page-viewer__image"
                draggable={false}
              />
              <div className="pdf-page-viewer__overlays" style={{ width: viewWidthPx, height: heightPx }}>
                {renderOverlays?.(viewWidthPx)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
