import { useLayoutEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { moveSlot, type Positions } from '../../lib/reorder';

const LONG_PRESS_MS = 200;
const SETTLE_MS = 150;

function positionsOf(keys: string[]): Positions {
  const map: Positions = {};
  keys.forEach((key, index) => {
    map[key] = index;
  });
  return map;
}

type RowState = {
  /** True while this row is lifted. */
  dragging: boolean;
  /** Wraps the drag handle so a 200ms long-press on it starts the drag. */
  renderHandle: (handle: ReactNode) => ReactNode;
};

/**
 * Vertical list of fixed-height rows that reorders by long-pressing a row's handle and dragging.
 * The lifted row scales to 1.02 with elevation 8; the rows it passes slide out of the way. Built
 * on gesture-handler + reanimated directly (no list library). `rowHeight` is dp.
 *
 * Every row's offset comes from a key → slot map on the UI thread, never from its React index, so
 * a dropped row sits at the same offset before and after the parent applies `onMove`.
 */
export function SortableList<T>({
  items,
  keyOf,
  rowHeight,
  onMove,
  renderRow,
}: {
  items: T[];
  keyOf: (item: T) => string;
  rowHeight: number;
  onMove: (from: number, to: number) => void;
  renderRow: (item: T, index: number, state: RowState) => ReactNode;
}) {
  const keys = items.map(keyOf);
  // A stable signature, so parent re-renders during a drag do not reset the slot map.
  const keySignature = keys.join('\n');
  const positions = useSharedValue<Positions>(positionsOf(keys));
  const activeKey = useSharedValue<string | null>(null);
  const dragTop = useSharedValue(0);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  // Adds, removals and accessibility moves change `items`; after a drag the map already matches.
  useLayoutEffect(() => {
    positions.set(positionsOf(keySignature ? keySignature.split('\n') : []));
  }, [keySignature, positions]);

  const commit = (from: number, to: number) => {
    setDraggingKey(null);
    if (from !== to) onMove(from, to);
  };

  return (
    <View style={{ height: items.length * rowHeight }}>
      {items.map((item, index) => {
        const key = keyOf(item);
        return (
          <SortableRow
            key={key}
            rowKey={key}
            index={index}
            count={items.length}
            rowHeight={rowHeight}
            positions={positions}
            activeKey={activeKey}
            dragTop={dragTop}
            onLift={setDraggingKey}
            onCommit={commit}
          >
            {(renderHandle) =>
              renderRow(item, index, { dragging: draggingKey === key, renderHandle })
            }
          </SortableRow>
        );
      })}
    </View>
  );
}

function SortableRow({
  rowKey,
  index,
  count,
  rowHeight,
  positions,
  activeKey,
  dragTop,
  onLift,
  onCommit,
  children,
}: {
  rowKey: string;
  index: number;
  count: number;
  rowHeight: number;
  positions: SharedValue<Positions>;
  activeKey: SharedValue<string | null>;
  dragTop: SharedValue<number>;
  onLift: (key: string | null) => void;
  onCommit: (from: number, to: number) => void;
  children: (renderHandle: (handle: ReactNode) => ReactNode) => ReactNode;
}) {
  const startSlot = useSharedValue(0);
  const snapshot = useSharedValue<Positions>({});

  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      const current = positions.get();
      const slot = current[rowKey] ?? index;
      snapshot.set(current);
      startSlot.set(slot);
      dragTop.set(slot * rowHeight);
      activeKey.set(rowKey);
      runOnJS(onLift)(rowKey);
    })
    .onUpdate((event) => {
      const top = startSlot.get() * rowHeight + event.translationY;
      dragTop.set(top);
      const target = Math.max(0, Math.min(count - 1, Math.round(top / rowHeight)));
      const current = positions.get();
      if (current[rowKey] !== target) positions.set(moveSlot(current, rowKey, target));
    })
    .onEnd((_event, success) => {
      const from = startSlot.get();
      if (!success) {
        positions.set(snapshot.get());
        dragTop.set(
          withTiming(from * rowHeight, { duration: SETTLE_MS }, () => {
            activeKey.set(null);
            runOnJS(onLift)(null);
          }),
        );
        return;
      }
      const to = positions.get()[rowKey] ?? from;
      dragTop.set(
        withTiming(to * rowHeight, { duration: SETTLE_MS }, (finished) => {
          if (!finished) {
            // Interrupted (another drag began): drop this move rather than commit a half state.
            positions.set(snapshot.get());
            if (activeKey.get() === rowKey) activeKey.set(null);
            runOnJS(onLift)(null);
            return;
          }
          activeKey.set(null);
          runOnJS(onCommit)(from, to);
        }),
      );
    });

  const animatedStyle = useAnimatedStyle(() => {
    if (activeKey.get() === rowKey) {
      return {
        zIndex: 10,
        elevation: 8,
        transform: [{ translateY: dragTop.get() }, { scale: 1.02 }],
      };
    }
    const slot = positions.get()[rowKey] ?? index;
    return {
      zIndex: 0,
      elevation: 0,
      transform: [
        { translateY: withTiming(slot * rowHeight, { duration: SETTLE_MS }) },
        { scale: 1 },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        { position: 'absolute', left: 0, right: 0, top: 0, height: rowHeight },
        animatedStyle,
      ]}
    >
      {children((handle) => (
        <GestureDetector gesture={pan}>{handle}</GestureDetector>
      ))}
    </Animated.View>
  );
}
