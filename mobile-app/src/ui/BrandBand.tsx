import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme, useUi } from '../hooks/useAppTheme';
import { UiText } from './UiText';

/** How far (dp) the sheet overlaps the band; also the scroll distance over which the band collapses. */
const SHEET_OVERLAP = 24;
const SHEET_RADIUS = 24;

type ScrollEndEvent = NativeSyntheticEvent<NativeScrollEvent>;

/**
 * Scroll state for a collapsing BrandBand. Pass `scrollY` and `onCollapseDistance` to the band,
 * and `onScroll`, `scrollEventThrottle`, `onScrollEndDrag` and `onMomentumScrollEnd` to the list
 * inside it. When scrolling stops part-way through the collapse, `scrollToY` (offset in dp) is
 * called to settle the list fully open or fully collapsed.
 */
export function useBandCollapse(scrollToY: (offsetY: number) => void) {
  const [scrollY] = useState(() => new Animated.Value(0));
  const distanceRef = useRef(0);
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
      }),
    [scrollY],
  );
  const snap = useCallback(
    (offsetY: number) => {
      const target = snapOffset(offsetY, distanceRef.current);
      if (target !== null) scrollToY(target);
    },
    [scrollToY],
  );
  const onScrollEndDrag = useCallback(
    (event: ScrollEndEvent) => {
      // A fling ends in onMomentumScrollEnd instead.
      if (Math.abs(event.nativeEvent.velocity?.y ?? 0) < 0.05) {
        snap(event.nativeEvent.contentOffset.y);
      }
    },
    [snap],
  );
  const onMomentumScrollEnd = useCallback(
    (event: ScrollEndEvent) => snap(event.nativeEvent.contentOffset.y),
    [snap],
  );
  const setDistance = useCallback((distance: number) => {
    distanceRef.current = distance;
  }, []);
  return {
    scrollY,
    setDistance,
    onScroll,
    scrollEventThrottle: 16,
    onScrollEndDrag,
    onMomentumScrollEnd,
  };
}

/**
 * Where a list stopped part-way through the band collapse should settle: the nearer of fully
 * open (0) and fully collapsed (`distance`), or null when it needs no snap.
 *
 * @param offsetY Scroll offset in dp.
 * @param distance Collapse distance in dp.
 */
export function snapOffset(offsetY: number, distance: number): number | null {
  if (distance <= 0 || offsetY <= 0 || offsetY >= distance) return null;
  return offsetY < distance / 2 ? 0 : distance;
}

/**
 * Blue brand band (64dp app bar + optional extra content) with a white sheet that overlaps it by
 * 24dp. With `scrollY`, scrolling first slides the extra content (the search field) up and fades
 * it out while the band shrinks, then slides the sheet up and squares its corners, so the band
 * ends as a plain bar. Every step follows the finger and reverses on the way back.
 */
export function BrandBand({
  title,
  leading,
  actions,
  bandExtra,
  scrollY,
  onCollapseDistance,
  children,
}: {
  title: string;
  leading?: ReactNode;
  actions?: ReactNode;
  bandExtra?: ReactNode;
  scrollY?: Animated.Value;
  /** Receives the total collapse distance in dp whenever it changes. */
  onCollapseDistance?: (distance: number) => void;
  children: ReactNode;
}) {
  const ui = useUi();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  // Natural height (dp) of the extra content; re-measured when it changes (Files adds tabs).
  const [extraHeight, setExtraHeight] = useState(0);
  const collapsing = scrollY !== undefined && (bandExtra === undefined || extraHeight > 0);

  const extraStyle =
    collapsing && bandExtra !== undefined && scrollY
      ? {
          height: scrollY.interpolate({
            inputRange: [0, extraHeight],
            outputRange: [extraHeight, 0],
            extrapolate: 'clamp',
          }),
          overflow: 'hidden' as const,
        }
      : undefined;
  const extraInnerStyle =
    collapsing && bandExtra !== undefined && scrollY
      ? {
          opacity: scrollY.interpolate({
            inputRange: [0, extraHeight * 0.6],
            outputRange: [1, 0],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              translateY: scrollY.interpolate({
                inputRange: [0, extraHeight],
                outputRange: [0, -extraHeight * 0.35],
                extrapolate: 'clamp',
              }),
            },
            {
              scale: scrollY.interpolate({
                inputRange: [0, extraHeight],
                outputRange: [1, 0.94],
                extrapolate: 'clamp',
              }),
            },
          ],
        }
      : undefined;

  const sheetStart = bandExtra !== undefined ? extraHeight : 0;
  const collapseDistance = sheetStart + SHEET_OVERLAP;
  useEffect(() => {
    if (collapsing) onCollapseDistance?.(collapseDistance);
  }, [collapsing, collapseDistance, onCollapseDistance]);
  const sheetProgress =
    collapsing && scrollY
      ? scrollY.interpolate({
          inputRange: [sheetStart, sheetStart + SHEET_OVERLAP],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        })
      : undefined;
  const radius = sheetProgress?.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_RADIUS, 0],
  });

  return (
    <View style={{ flex: 1, backgroundColor: ui.brand }}>
      <View style={{ paddingTop: insets.top, paddingBottom: 48 }}>
        <View
          style={{
            height: 64,
            flexDirection: 'row',
            alignItems: 'center',
            paddingLeft: leading ? 4 : 16,
            paddingRight: 4,
            gap: 4,
          }}
        >
          {leading}
          <UiText
            variant="title"
            color="#FFFFFF"
            style={{ flex: 1 }}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </UiText>
          {actions}
        </View>
        {bandExtra !== undefined ? (
          <Animated.View style={extraStyle}>
            <Animated.View
              style={extraInnerStyle}
              onLayout={(event) => {
                const height = event.nativeEvent.layout.height;
                if (height > 0 && Math.abs(height - extraHeight) > 0.5) setExtraHeight(height);
              }}
            >
              {bandExtra}
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
      <Animated.View
        style={{
          flex: 1,
          marginTop: -SHEET_OVERLAP,
          // The sheet slides up by up to 24dp; extend it so its bottom still meets the screen edge.
          marginBottom: sheetProgress ? -SHEET_OVERLAP : 0,
          backgroundColor: theme.colors.surface,
          borderTopLeftRadius: radius ?? SHEET_RADIUS,
          borderTopRightRadius: radius ?? SHEET_RADIUS,
          overflow: 'hidden',
          transform: sheetProgress
            ? [{ translateY: Animated.multiply(sheetProgress, -SHEET_OVERLAP) }]
            : undefined,
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
