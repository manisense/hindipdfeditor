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

const LONG_PRESS_MS = 200;
const SETTLE_MS = 150;

/**
 * Index a dragged row would land on. `from` and the result are 0-based indices; `dy` and
 * `rowHeight` are dp.
 */
function hoverIndex(from: number, dy: number, rowHeight: number, count: number): number {
  'worklet';
  return Math.max(0, Math.min(count - 1, Math.round(from + dy / rowHeight)));
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
  const activeIndex = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const [draggingIndex, setDraggingIndex] = useState(-1);

  // The reordered list renders in the same frame the lifted row drops back to offset 0.
  useLayoutEffect(() => {
    activeIndex.set(-1);
    dragY.set(0);
  }, [items, activeIndex, dragY]);

  const drop = (from: number, to: number) => {
    setDraggingIndex(-1);
    if (from === to) {
      activeIndex.set(-1);
      dragY.set(0);
      return;
    }
    onMove(from, to);
  };

  return (
    <View>
      {items.map((item, index) => (
        <SortableRow
          key={keyOf(item)}
          index={index}
          count={items.length}
          rowHeight={rowHeight}
          activeIndex={activeIndex}
          dragY={dragY}
          onLift={setDraggingIndex}
          onDrop={drop}
        >
          {(renderHandle) =>
            renderRow(item, index, { dragging: draggingIndex === index, renderHandle })
          }
        </SortableRow>
      ))}
    </View>
  );
}

function SortableRow({
  index,
  count,
  rowHeight,
  activeIndex,
  dragY,
  onLift,
  onDrop,
  children,
}: {
  index: number;
  count: number;
  rowHeight: number;
  activeIndex: SharedValue<number>;
  dragY: SharedValue<number>;
  onLift: (index: number) => void;
  onDrop: (from: number, to: number) => void;
  children: (renderHandle: (handle: ReactNode) => ReactNode) => ReactNode;
}) {
  const pan = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart(() => {
      activeIndex.set(index);
      dragY.set(0);
      runOnJS(onLift)(index);
    })
    .onUpdate((event) => {
      dragY.set(event.translationY);
    })
    .onEnd(() => {
      const to = hoverIndex(index, dragY.get(), rowHeight, count);
      dragY.set(
        withTiming((to - index) * rowHeight, { duration: SETTLE_MS }, () => {
          runOnJS(onDrop)(index, to);
        }),
      );
    })
    .onFinalize((_event, success) => {
      if (success) return;
      activeIndex.set(-1);
      dragY.set(withTiming(0, { duration: SETTLE_MS }));
      runOnJS(onLift)(-1);
    });

  const animatedStyle = useAnimatedStyle(() => {
    const active = activeIndex.get();
    if (active === index) {
      return {
        zIndex: 10,
        elevation: 8,
        transform: [{ translateY: dragY.get() }, { scale: 1.02 }],
      };
    }
    let shift = 0;
    if (active >= 0) {
      const hover = hoverIndex(active, dragY.get(), rowHeight, count);
      if (active < index && index <= hover) shift = -rowHeight;
      else if (hover <= index && index < active) shift = rowHeight;
    }
    return {
      zIndex: 0,
      elevation: 0,
      transform: [
        { translateY: active >= 0 ? withTiming(shift, { duration: SETTLE_MS }) : 0 },
        { scale: 1 },
      ],
    };
  });

  return (
    <Animated.View style={[{ height: rowHeight }, animatedStyle]}>
      {children((handle) => (
        <GestureDetector gesture={pan}>{handle}</GestureDetector>
      ))}
    </Animated.View>
  );
}
