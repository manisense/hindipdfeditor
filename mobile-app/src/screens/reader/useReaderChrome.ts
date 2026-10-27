import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

/** Scroll distance in one direction, in dp, before the bar hides or comes back. */
const DIRECTION_THRESHOLD = 24;
/** How long the page pill stays after scrolling stops, in ms. */
const PILL_HOLD_MS = 1500;

/**
 * Reader chrome state: the bar and Edit button hide on scroll down, come back on scroll up and
 * toggle on tap. `progress` runs from 0 (hidden) to 1 (shown) on the native driver; the page pill
 * fades in while scrolling and out `PILL_HOLD_MS` after the last scroll event.
 */
export function useReaderChrome() {
  const [visible, setVisible] = useState(true);
  const visibleRef = useRef(true);
  const [progress] = useState(() => new Animated.Value(1));
  const [pillOpacity] = useState(() => new Animated.Value(0));
  const anchorYRef = useRef(0);
  const reanchorRef = useRef(false);
  const pillShownRef = useRef(false);
  const pillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (pillTimerRef.current) clearTimeout(pillTimerRef.current);
    },
    [],
  );

  const setChrome = useCallback(
    (next: boolean) => {
      if (visibleRef.current === next) return;
      visibleRef.current = next;
      setVisible(next);
      Animated.timing(progress, {
        toValue: next ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    },
    [progress],
  );

  const toggle = useCallback(() => setChrome(!visibleRef.current), [setChrome]);

  const show = useCallback(() => setChrome(true), [setChrome]);

  /** Call before a programmatic scroll so its jump is not read as scrolling down or up. */
  const ignoreNextScroll = useCallback(() => {
    reanchorRef.current = true;
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = event.nativeEvent.contentOffset.y;
      if (reanchorRef.current) {
        reanchorRef.current = false;
        anchorYRef.current = y;
      } else if (y <= 0) {
        anchorYRef.current = 0;
        setChrome(true);
      } else if (y - anchorYRef.current > DIRECTION_THRESHOLD) {
        anchorYRef.current = y;
        setChrome(false);
      } else if (anchorYRef.current - y > DIRECTION_THRESHOLD) {
        anchorYRef.current = y;
        setChrome(true);
      }

      if (!pillShownRef.current) {
        pillShownRef.current = true;
        Animated.timing(pillOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      }
      if (pillTimerRef.current) clearTimeout(pillTimerRef.current);
      pillTimerRef.current = setTimeout(() => {
        pillShownRef.current = false;
        Animated.timing(pillOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }, PILL_HOLD_MS);
    },
    [pillOpacity, setChrome],
  );

  return { visible, progress, pillOpacity, onScroll, toggle, show, ignoreNextScroll };
}
