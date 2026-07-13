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
import { clampPageScroll } from '../lib/pageViewportMath';
import type { PageState, TextEdit } from '../state/editStore';

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
/** Keep the selected text comfortably inside the viewport above the software keyboard, in dp. */
const FOCUS_REVEAL_MARGIN_DP = 56;

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
  const [viewportHeightDp, setViewportHeightDp] = useState(0);
  const [zoom, setZoom] = useState(1);

  const horizontalScrollRef = useRef<ScrollView>(null);
  const verticalScrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef({ x: 0, y: 0 });
  const containerOriginRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<View>(null);

  const pageRef = useRef(page);
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

  useLayoutEffect(() => {
    pageRef.current = page;
  }, [page]);

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
    horizontalScrollRef.current?.scrollTo({ x, animated: false });
    verticalScrollRef.current?.scrollTo({ y, animated: false });
    scrollOffsetRef.current = { x, y };
    pendingScrollRef.current = null;
  }, [zoom, baseViewWidthDp, viewportHeightDp]);

  useLayoutEffect(() => {
    if (!focusedEditId) return;
    if (baseViewWidthDp <= 0 || viewportHeightDp <= 0) return;
    const currentPage = pageRef.current;
    const edit = currentPage.edits.find(
      (candidate): candidate is TextEdit =>
        candidate.type === 'text' && candidate.id === focusedEditId,
    );
    if (!edit) return;

    const scaleDpPerPt = baseViewWidthDp / currentPage.widthPt;
    const editLeft = edit.xPt * scaleDpPerPt * zoomRef.current;
    const editTop = edit.yPt * scaleDpPerPt * zoomRef.current;
    const editWidth =
      (edit.widthPt ?? Math.max(96, edit.fontSizePt * 8)) * scaleDpPerPt * zoomRef.current;
    const editHeight = edit.fontSizePt * 1.8 * scaleDpPerPt * zoomRef.current;
    const { x: currentX, y: currentY } = scrollOffsetRef.current;

    let nextX = currentX;
    let nextY = currentY;
    if (editLeft < currentX + FOCUS_REVEAL_MARGIN_DP) {
      nextX = editLeft - FOCUS_REVEAL_MARGIN_DP;
    } else if (editLeft + editWidth > currentX + baseViewWidthDp - FOCUS_REVEAL_MARGIN_DP) {
      nextX = editLeft + editWidth - baseViewWidthDp + FOCUS_REVEAL_MARGIN_DP;
    }
    if (editTop < currentY + FOCUS_REVEAL_MARGIN_DP) {
      nextY = editTop - FOCUS_REVEAL_MARGIN_DP;
    } else if (editTop + editHeight > currentY + viewportHeightDp - FOCUS_REVEAL_MARGIN_DP) {
      nextY = editTop + editHeight - viewportHeightDp + FOCUS_REVEAL_MARGIN_DP;
    }

    const pageHeightDp = baseViewWidthDp * (currentPage.imagePxHeight / currentPage.imagePxWidth);
    const nextScroll = clampPageScroll(
      nextX,
      nextY,
      zoomRef.current,
      baseViewWidthDp,
      viewportHeightDp,
      baseViewWidthDp,
      pageHeightDp,
    );
    horizontalScrollRef.current?.scrollTo({ x: nextScroll.x, animated: false });
    verticalScrollRef.current?.scrollTo({ y: nextScroll.y, animated: false });
    scrollOffsetRef.current = nextScroll;
  }, [focusedEditId, baseViewWidthDp, viewportHeightDp]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBaseViewWidthDp(width);
    setViewportHeightDp(height);
    viewportSizeRef.current = {
      width,
      height,
    };
    containerRef.current?.measureInWindow((x, y) => {
      containerOriginRef.current = { x, y };
    });
  };

  const pageHeightDp =
    baseViewWidthDp > 0 ? baseViewWidthDp * (page.imagePxHeight / page.imagePxWidth) : 0;

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
      const nextScroll = clampPageScroll(
        scrollX * ratio + focalViewX * (ratio - 1),
        scrollY * ratio + focalViewY * (ratio - 1),
        newZoom,
        viewportW,
        viewportH,
        baseViewWidthDp,
        pageHeightDp,
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

  const captureMultiTouch = (event: GestureResponderEvent) => event.nativeEvent.touches.length >= 2;

  return (
    <View
      ref={containerRef}
      style={styles.container}
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
      {baseViewWidthDp > 0 && viewportHeightDp > 0 && (
        <ScrollView
          ref={horizontalScrollRef}
          horizontal
          style={styles.scrollViewport}
          contentContainerStyle={{
            width: baseViewWidthDp * zoom,
            height: viewportHeightDp,
          }}
          scrollEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="always"
          // React Native Android otherwise honors TextInput's caret-reveal request after every
          // controlled value update. Its transformed bounds are wrong at page zoom, which caused
          // the observed per-letter corner jumps. Focus reveal is handled explicitly above.
          scrollsChildToFocus={false}
          onScroll={(event) => {
            scrollOffsetRef.current.x = event.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
        >
          <ScrollView
            ref={verticalScrollRef}
            style={{ width: baseViewWidthDp * zoom, height: viewportHeightDp }}
            contentContainerStyle={{
              width: baseViewWidthDp * zoom,
              height: Math.max(pageHeightDp * zoom, viewportHeightDp),
            }}
            scrollEnabled
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled
            keyboardShouldPersistTaps="always"
            scrollsChildToFocus={false}
            onScroll={(event) => {
              scrollOffsetRef.current.y = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            <View style={{ width: baseViewWidthDp * zoom, height: pageHeightDp * zoom }}>
              <View
                style={{
                  width: baseViewWidthDp,
                  height: pageHeightDp,
                  transform: [{ scale: zoom }],
                  transformOrigin: 'top left',
                }}
              >
                <Image
                  source={{ uri: page.backgroundImageUri }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="stretch"
                />
                <View
                  style={[styles.overlayLayer, { width: baseViewWidthDp, height: pageHeightDp }]}
                >
                  {renderOverlays?.(baseViewWidthDp)}
                </View>
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    minHeight: 220,
    overflow: 'hidden',
  },
  scrollViewport: {
    flex: 1,
  },
  overlayLayer: {
    position: 'relative',
  },
});
