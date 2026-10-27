import { useEffect, type ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { clampPan, MAX_ZOOM, MIN_ZOOM, zoomAround } from '../../lib/zoomMath';

/** Zoom a double tap goes to from the fitted size. */
const DOUBLE_TAP_ZOOM = 2.5;
const ZOOM_EPSILON = 0.01;

/**
 * One Reader page, `width` x `height` dp, that zooms like a book page: pinch to zoom about the
 * fingers, double-tap to zoom in at the tap or back out, and drag to move while zoomed. A single
 * tap calls `onTap`. While unzoomed the drag is left to the page list, so a swipe turns the page;
 * `onZoomedChange` reports when that changes. Zoom resets when the page stops being `active`.
 */
export function ZoomablePage({
  width,
  height,
  active,
  onTap,
  onZoomedChange,
  children,
}: {
  width: number;
  height: number;
  active: boolean;
  onTap: () => void;
  onZoomedChange: (zoomed: boolean) => void;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const zoomed = useSharedValue(false);

  const report = (next: boolean) => {
    'worklet';
    if (zoomed.get() === next) return;
    zoomed.set(next);
    runOnJS(onZoomedChange)(next);
  };

  useEffect(() => {
    if (active) return;
    scale.set(1);
    panX.set(0);
    panY.set(0);
    if (zoomed.get()) {
      zoomed.set(false);
      onZoomedChange(false);
    }
  }, [active, scale, panX, panY, zoomed, onZoomedChange]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.set(scale.get());
      startX.set(panX.get());
      startY.set(panY.get());
    })
    .onUpdate((e) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, startScale.get() * e.scale));
      const focal = { x: e.focalX - width / 2, y: e.focalY - height / 2 };
      const pan = zoomAround({ x: startX.get(), y: startY.get() }, startScale.get(), next, focal);
      const clamped = clampPan(pan.x, pan.y, next, width, height);
      scale.set(next);
      panX.set(clamped.x);
      panY.set(clamped.y);
    })
    .onEnd(() => {
      if (scale.get() < 1 + ZOOM_EPSILON) {
        scale.set(withTiming(1));
        panX.set(withTiming(0));
        panY.set(withTiming(0));
        report(false);
      } else {
        report(true);
      }
    });

  // Only claims the drag while zoomed; otherwise it fails and the list turns the page.
  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesMove((_e, manager) => {
      if (scale.get() > 1 + ZOOM_EPSILON) manager.activate();
      else manager.fail();
    })
    .onStart(() => {
      startX.set(panX.get());
      startY.set(panY.get());
    })
    .onUpdate((e) => {
      const clamped = clampPan(
        startX.get() + e.translationX,
        startY.get() + e.translationY,
        scale.get(),
        width,
        height,
      );
      panX.set(clamped.x);
      panY.set(clamped.y);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.get() > 1 + ZOOM_EPSILON) {
        scale.set(withTiming(1));
        panX.set(withTiming(0));
        panY.set(withTiming(0));
        report(false);
        return;
      }
      const focal = { x: e.x - width / 2, y: e.y - height / 2 };
      const target = zoomAround({ x: 0, y: 0 }, 1, DOUBLE_TAP_ZOOM, focal);
      const clamped = clampPan(target.x, target.y, DOUBLE_TAP_ZOOM, width, height);
      scale.set(withTiming(DOUBLE_TAP_ZOOM));
      panX.set(withTiming(clamped.x));
      panY.set(withTiming(clamped.y));
      report(true);
    });

  const singleTap = Gesture.Tap().onEnd(() => {
    runOnJS(onTap)();
  });

  const gesture = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.get() }, { translateY: panY.get() }, { scale: scale.get() }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, style]}>{children}</Animated.View>
    </GestureDetector>
  );
}
