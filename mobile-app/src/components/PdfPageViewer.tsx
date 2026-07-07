import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type NativeTouchEvent,
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
  /** When set, a two-finger pinch resizes this edit instead of zooming the page. */
  focusedEditId?: string | null;
  /** Fired once when a two-finger edit-resize pinch begins (caller should checkpoint). */
  onEditPinchStart?: (editId: string) => void;
  /** Fired during edit-resize pinch; `scale` is relative to pinch start (1 = unchanged). */
  onEditPinchResize?: (editId: string, scale: number) => void;
  /** Fired when a two-finger edit-resize pinch ends. */
  onEditPinchEnd?: () => void;
  /** Current zoom factor (1 = fit width), for optional UI hints in the caller. */
  onZoomChange?: (zoom: number) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
/** Ignore drags shorter than this when distinguishing tap from pan, in dp. */
const TAP_SLOP_DP = 8;

function pinchDistance(touches: readonly NativeTouchEvent[]): number {
  if (touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pinchCenter(touches: readonly NativeTouchEvent[]): { pageX: number; pageY: number } {
  const [a, b] = touches;
  return { pageX: (a.pageX + b.pageX) / 2, pageY: (a.pageY + b.pageY) / 2 };
}

function clampScroll(
  scrollX: number,
  scrollY: number,
  zoom: number,
  viewportW: number,
  viewportH: number,
): { x: number; y: number } {
  const maxX = Math.max(0, viewportW * zoom - viewportW);
  const maxY = Math.max(0, viewportH * zoom - viewportH);
  return {
    x: clamp(scrollX, 0, maxX),
    y: clamp(scrollY, 0, maxY),
  };
}

/**
 * Displays a page's rasterized background image at fit-to-width, with pinch-to-zoom and scroll-
 * to-pan when zoomed. Two-finger pinch on a focused text edit (via `focusedEditId`) resizes
 * that edit instead of zooming the page. Tap positions are converted to PDF points via
 * `coordinateMath.ts`, accounting for zoom and scroll offset.
 */
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
  const [baseViewWidthDp, setBaseViewWidthDp] = useState(0);
  const [zoom, setZoom] = useState(1);

  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef({ x: 0, y: 0 });
  const containerOriginRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<View>(null);

  const zoomRef = useRef(zoom);
  const focusedEditIdRef = useRef(focusedEditId);
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const pendingScrollRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{
    mode: 'page' | 'edit' | null;
    startDist: number;
    startZoom: number;
  }>({ mode: null, startDist: 0, startZoom: 1 });
  const touchStartRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const scrollAtTouchStartRef = useRef({ x: 0, y: 0 });
  const touchMovedRef = useRef(false);

  useEffect(() => {
    zoomRef.current = zoom;
    onZoomChange?.(zoom);
  }, [zoom, onZoomChange]);

  useEffect(() => {
    focusedEditIdRef.current = focusedEditId;
  }, [focusedEditId]);

  useLayoutEffect(() => {
    if (pendingScrollRef.current === null) return;
    const { x, y } = pendingScrollRef.current;
    scrollRef.current?.scrollTo({ x, y, animated: false });
    scrollOffsetRef.current = { x, y };
    pendingScrollRef.current = null;
  }, [zoom]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setBaseViewWidthDp(width);
    viewportSizeRef.current = {
      width,
      height: width * (page.imagePxHeight / page.imagePxWidth),
    };
    containerRef.current?.measureInWindow((x, y) => {
      containerOriginRef.current = { x, y };
    });
  };

  const heightDp = baseViewWidthDp > 0 ? baseViewWidthDp * (page.imagePxHeight / page.imagePxWidth) : 0;

  const pageCoordsFromTouch = (pageX: number, pageY: number) => {
    const { x: originX, y: originY } = containerOriginRef.current;
    const localX = pageX - originX + scrollOffsetRef.current.x;
    const localY = pageY - originY + scrollOffsetRef.current.y;
    const xDp = localX / zoomRef.current;
    const yDp = localY / zoomRef.current;
    return dpToPt(xDp, yDp, baseViewWidthDp, page.widthPt);
  };

  const beginPinch = (touches: readonly NativeTouchEvent[]) => {
    const dist = pinchDistance(touches);
    if (dist <= 0) return;
    containerRef.current?.measureInWindow((x, y) => {
      containerOriginRef.current = { x, y };
    });
    const editId = focusedEditIdRef.current;
    const mode = editId ? 'edit' : 'page';
    pinchRef.current = { mode, startDist: dist, startZoom: zoomRef.current };
    if (mode === 'edit' && editId) {
      onEditPinchStart?.(editId);
    }
  };

  const updatePinch = (touches: readonly NativeTouchEvent[]) => {
    const session = pinchRef.current;
    if (!session.mode) return;
    const dist = pinchDistance(touches);
    if (dist <= 0 || session.startDist <= 0) return;
    touchMovedRef.current = true;
    const scale = dist / session.startDist;
    if (session.mode === 'page') {
      const prevZoom = zoomRef.current;
      const newZoom = clamp(session.startZoom * scale, MIN_ZOOM, MAX_ZOOM);
      if (prevZoom === newZoom) return;

      const { pageX, pageY } = pinchCenter(touches);
      const { x: originX, y: originY } = containerOriginRef.current;
      const focalViewX = pageX - originX;
      const focalViewY = pageY - originY;
      const ratio = newZoom / prevZoom;
      const { x: scrollX, y: scrollY } = scrollOffsetRef.current;
      const { width: viewportW, height: viewportH } = viewportSizeRef.current;
      const nextScroll = clampScroll(
        scrollX * ratio + focalViewX * (ratio - 1),
        scrollY * ratio + focalViewY * (ratio - 1),
        newZoom,
        viewportW,
        viewportH,
      );
      pendingScrollRef.current = nextScroll;
      setZoom(newZoom);
    } else {
      const editId = focusedEditIdRef.current;
      if (editId) onEditPinchResize?.(editId, scale);
    }
  };

  const endPinch = () => {
    if (pinchRef.current.mode === 'edit') {
      onEditPinchEnd?.();
    }
    pinchRef.current = { mode: null, startDist: 0, startZoom: zoomRef.current };
  };

  const handleTouchStart = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    touchMovedRef.current = false;
    scrollAtTouchStartRef.current = { ...scrollOffsetRef.current };
    if (touches.length === 1) {
      touchStartRef.current = { pageX: touches[0].pageX, pageY: touches[0].pageY };
    }
    if (touches.length === 2) {
      beginPinch(touches);
    }
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    const touches = event.nativeEvent.touches;
    if (touches.length === 2) {
      if (!pinchRef.current.mode) beginPinch(touches);
      updatePinch(touches);
      return;
    }
    const start = touchStartRef.current;
    if (start && touches.length === 1) {
      const moved = Math.hypot(touches[0].pageX - start.pageX, touches[0].pageY - start.pageY);
      if (moved > TAP_SLOP_DP) touchMovedRef.current = true;
    }
  };

  const handleTouchEnd = (event: GestureResponderEvent) => {
    const remaining = event.nativeEvent.touches.length;
    if (remaining >= 2) {
      updatePinch(event.nativeEvent.touches);
      return;
    }
    if (remaining === 1 && pinchRef.current.mode) {
      endPinch();
      return;
    }
    if (remaining === 0) {
      if (pinchRef.current.mode) endPinch();
      const scrollDelta = Math.hypot(
        scrollOffsetRef.current.x - scrollAtTouchStartRef.current.x,
        scrollOffsetRef.current.y - scrollAtTouchStartRef.current.y,
      );
      if (scrollDelta > TAP_SLOP_DP) touchMovedRef.current = true;
      if (!disablePress && !touchMovedRef.current && touchStartRef.current) {
        const { pageX, pageY } = touchStartRef.current;
        if (baseViewWidthDp > 0) {
          containerRef.current?.measureInWindow((x, y) => {
            containerOriginRef.current = { x, y };
            const { xPt, yPt } = pageCoordsFromTouch(pageX, pageY);
            onTap(xPt, yPt);
          });
        }
      }
      touchStartRef.current = null;
    }
  };

  const captureMultiTouch = (event: GestureResponderEvent) =>
    event.nativeEvent.touches.length >= 2;

  return (
    <View
      ref={containerRef}
      style={[styles.container, heightDp > 0 && { height: heightDp }]}
      onLayout={handleLayout}
      onStartShouldSetResponderCapture={captureMultiTouch}
      onMoveShouldSetResponderCapture={captureMultiTouch}
      onResponderGrant={(event) => {
        if (event.nativeEvent.touches.length >= 2) beginPinch(event.nativeEvent.touches);
      }}
      onResponderMove={(event) => {
        if (event.nativeEvent.touches.length >= 2) updatePinch(event.nativeEvent.touches);
      }}
      onResponderRelease={handleTouchEnd}
      onResponderTerminate={endPinch}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {baseViewWidthDp > 0 && (
        <ScrollView
          ref={scrollRef}
          style={{ width: baseViewWidthDp, height: heightDp }}
          contentContainerStyle={{
            width: baseViewWidthDp * zoom,
            height: heightDp * zoom,
          }}
          scrollEnabled
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            scrollOffsetRef.current = event.nativeEvent.contentOffset;
          }}
          scrollEventThrottle={16}
        >
          <View style={{ width: baseViewWidthDp * zoom, height: heightDp * zoom }}>
            <View
              style={{
                width: baseViewWidthDp,
                height: heightDp,
                transform: [{ scale: zoom }],
                transformOrigin: 'top left',
              }}
            >
              <Image
                source={{ uri: page.backgroundImageUri }}
                style={StyleSheet.absoluteFill}
                resizeMode="stretch"
              />
              <View style={[styles.overlayLayer, { width: baseViewWidthDp, height: heightDp }]}>
                {renderOverlays?.(baseViewWidthDp)}
              </View>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  overlayLayer: {
    position: 'relative',
  },
});
