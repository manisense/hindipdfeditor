import { useState } from 'react';
import { Image, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useUi } from '../../hooks/useAppTheme';
import { useTx } from '../../i18n';
import { createThrottle } from '../../lib/readerLayout';
import { Icon } from '../../ui/Icon';
import { UiText } from '../../ui/UiText';

/** Touch column width, in dp (the visible track is 4dp at its right edge). */
const COLUMN_WIDTH = 48;
/** Thumb size, in dp. */
const THUMB_WIDTH = 16;
const THUMB_HEIGHT = 56;
/** Extra grab area above and below the thumb, in dp. */
const GRAB_SLOP = 12;
/** Preview bubble height (60x85dp thumbnail plus 12dp padding), in dp. */
const BUBBLE_HEIGHT = 109;
/** Minimum time between `onScrubTo` calls while dragging, in ms. */
const SCRUB_INTERVAL_MS = 50;

/**
 * Fast scroller on the right edge of the Reader: a 4dp track with a 16x56dp brand thumb. Dragging
 * the thumb moves it on the UI thread, shows a preview bubble (thumbnail, page number, "of n") and
 * calls `onScrubTo` with a zero-based page at most once per 50 ms, plus once on release. Fills its
 * parent's height. TalkBack users get an adjustable control (swipe up or down to change page).
 */
export function PageScroller({
  pageCount,
  currentPage,
  onScrubTo,
  previewUriFor,
}: {
  pageCount: number;
  currentPage: number;
  onScrubTo: (page: number) => void;
  previewUriFor: (page: number) => string | undefined;
}) {
  const ui = useUi();
  const tx = useTx();
  const [trackHeight, setTrackHeight] = useState(0);
  /** Page under the thumb while dragging (zero-based); null when idle. */
  const [dragPage, setDragPage] = useState<number | null>(null);
  const [throttle] = useState(() => createThrottle(SCRUB_INTERVAL_MS));

  const dragging = useSharedValue(false);
  const startTop = useSharedValue(0);
  const dragTop = useSharedValue(0);
  const lastPage = useSharedValue(-1);

  const travel = Math.max(trackHeight - THUMB_HEIGHT, 0);
  const idleTop = pageCount > 1 ? (currentPage / (pageCount - 1)) * travel : 0;
  const lastIndex = pageCount - 1;

  const handlePage = (page: number, force: boolean) => {
    setDragPage(page);
    if (throttle.pass(page, force)) onScrubTo(page);
  };
  const handleStart = () => throttle.reset();
  const handleEnd = (page: number) => {
    if (throttle.pass(page, true)) onScrubTo(page);
    setDragPage(null);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      startTop.set(idleTop);
      dragTop.set(idleTop);
      lastPage.set(-1);
      dragging.set(true);
      runOnJS(handleStart)();
    })
    .onUpdate((event) => {
      const top = Math.min(Math.max(startTop.get() + event.translationY, 0), travel);
      dragTop.set(top);
      const page = travel > 0 ? Math.round((top / travel) * lastIndex) : 0;
      if (page !== lastPage.get()) {
        lastPage.set(page);
        runOnJS(handlePage)(page, false);
      }
    })
    .onFinalize(() => {
      if (!dragging.get()) return;
      dragging.set(false);
      const page = lastPage.get();
      runOnJS(handleEnd)(page >= 0 ? page : currentPage);
    });

  const thumbStyle = useAnimatedStyle(() => ({
    top: dragging.get() ? dragTop.get() : idleTop,
  }));
  const grabStyle = useAnimatedStyle(() => ({
    top: (dragging.get() ? dragTop.get() : idleTop) - GRAB_SLOP,
  }));
  const bubbleStyle = useAnimatedStyle(() => ({
    top: Math.min(
      Math.max(dragTop.get() + THUMB_HEIGHT / 2 - BUBBLE_HEIGHT / 2, 0),
      Math.max(trackHeight - BUBBLE_HEIGHT, 0),
    ),
  }));

  if (pageCount < 2) return null;

  const previewUri = dragPage !== null ? previewUriFor(dragPage) : undefined;
  const pageLabel = tx(
    `Page ${currentPage + 1} of ${pageCount}`,
    `पृष्ठ ${currentPage + 1} / ${pageCount}`,
  );

  return (
    <View
      onLayout={(event: LayoutChangeEvent) => setTrackHeight(event.nativeEvent.layout.height)}
      pointerEvents="box-none"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={tx('Page scroller', 'पृष्ठ स्क्रोलर')}
      accessibilityValue={{ min: 1, max: pageCount, now: currentPage + 1, text: pageLabel }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
        const next = Math.min(Math.max(currentPage + step, 0), lastIndex);
        if (next !== currentPage) onScrubTo(next);
      }}
      style={{ flex: 1, width: COLUMN_WIDTH }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(20, 22, 31, 0.16)',
        }}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            right: 0,
            width: THUMB_WIDTH,
            height: THUMB_HEIGHT,
            borderTopLeftRadius: 8,
            borderBottomLeftRadius: 8,
            backgroundColor: ui.brand,
          },
          thumbStyle,
        ]}
      />
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              right: 0,
              width: COLUMN_WIDTH,
              height: THUMB_HEIGHT + GRAB_SLOP * 2,
            },
            grabStyle,
          ]}
        />
      </GestureDetector>
      {dragPage !== null ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              right: COLUMN_WIDTH + 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 16,
              backgroundColor: ui.chrome,
              elevation: 6,
            },
            bubbleStyle,
          ]}
        >
          <View
            style={{
              width: 60,
              height: 85,
              borderRadius: 4,
              backgroundColor: '#FFFFFF',
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {previewUri ? (
              <Image
                source={{ uri: previewUri }}
                style={{ width: 60, height: 85 }}
                resizeMode="contain"
              />
            ) : (
              <Icon name="description" size={24} color="#71717A" />
            )}
          </View>
          <View>
            <UiText color="#FFFFFF" style={{ fontSize: 40, fontWeight: '700', lineHeight: 48 }}>
              {dragPage + 1}
            </UiText>
            <UiText variant="meta" color="#FFFFFF">
              {tx('of ' + pageCount, pageCount + ' में से')}
            </UiText>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}
