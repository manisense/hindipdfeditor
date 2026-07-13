import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TextInput, View } from 'react-native';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import { colors } from '../theme';
import type { TextEdit } from '../state/editStore';

type Props = {
  edit: TextEdit;
  /** The `PdfPageViewer`'s currently measured width, in dp - see that component's docstring. */
  viewWidthDp: number;
  /** The source page's width, in PDF points. */
  pageWidthPt: number;
  /** The source page's height, in PDF points. */
  pageHeightPt: number;
  /** Current page zoom factor (1 = fit width); used to convert drag movement back to points. */
  zoom: number;
  onChangeText: (text: string) => void;
  /** True for a just-created edit, so the keyboard opens immediately without a second tap. */
  autoFocus?: boolean;
  /** When true, selects all text once focused (OCR replacements - type to replace instantly). */
  selectAllOnFocus?: boolean;
  /** Whether this edit is the actively focused one (shows Canva-style selection outline). */
  focused?: boolean;
  onBlur?: () => void;
  /** Return false to reject focus (caller dismisses the current edit instead). */
  onFocus?: () => boolean | void;
  /** Checkpoints the edit once before a move-handle drag begins. */
  onMoveStart?: () => void;
  /** Moves the edit to an absolute page position, in PDF points. */
  onMove?: (xPt: number, yPt: number) => void;
  onMoveEnd?: () => void;
};

/**
 * Renders one `TextEdit` as a live, absolutely-positioned native `TextInput` on top of the
 * page's background image. Because this is a real native `TextInput`, Android's own text
 * stack (HarfBuzz-backed since Android O) shapes Devanagari correctly live - spec Section 8 -
 * with zero custom shaping code here or anywhere else in this app.
 *
 * Position and font size are both derived from the edit's stored PDF-point values via
 * `coordinateMath.ts`, using the same `viewWidthDp` the caller measured from `PdfPageViewer`,
 * so this overlay lines up with the same background image pixel that `htmlCompositor.ts`
 * will place it against at export time.
 */
export function EditableTextOverlay({
  edit,
  viewWidthDp,
  pageWidthPt,
  pageHeightPt,
  zoom,
  onChangeText,
  autoFocus,
  selectAllOnFocus,
  focused,
  onBlur,
  onFocus,
  onMoveStart,
  onMove,
  onMoveEnd,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const [draftPosition, setDraftPosition] = useState<{ xPt: number; yPt: number } | null>(null);
  const displayXPt = draftPosition?.xPt ?? edit.xPt;
  const displayYPt = draftPosition?.yPt ?? edit.yPt;
  const { xDp, yDp } = ptToDp(displayXPt, displayYPt, viewWidthDp, pageWidthPt);
  const fontSizeDp = edit.fontSizePt * (viewWidthDp / pageWidthPt);
  const desiredFallbackWidthPt = Math.max(120, pageWidthPt * 0.35);
  const availableWidthPt = Math.max(24, pageWidthPt - edit.xPt - 4);
  const effectiveWidthPt = edit.widthPt ?? Math.min(desiredFallbackWidthPt, availableWidthPt);
  const widthDp = ptSizeToDp(effectiveWidthPt, 0, viewWidthDp, pageWidthPt).wDp;
  const moveContextRef = useRef({
    xPt: edit.xPt,
    yPt: edit.yPt,
    fontSizePt: edit.fontSizePt,
    effectiveWidthPt,
    pageWidthPt,
    pageHeightPt,
    viewWidthDp,
    zoom,
  });
  const moveCallbacksRef = useRef({ onMoveStart, onMove, onMoveEnd });

  useLayoutEffect(() => {
    moveContextRef.current = {
      xPt: edit.xPt,
      yPt: edit.yPt,
      fontSizePt: edit.fontSizePt,
      effectiveWidthPt,
      pageWidthPt,
      pageHeightPt,
      viewWidthDp,
      zoom,
    };
    moveCallbacksRef.current = { onMoveStart, onMove, onMoveEnd };
  }, [
    edit.xPt,
    edit.yPt,
    edit.fontSizePt,
    effectiveWidthPt,
    pageWidthPt,
    pageHeightPt,
    viewWidthDp,
    zoom,
    onMoveStart,
    onMove,
    onMoveEnd,
  ]);

  const moveResponder = useMemo(
    () =>
      // PanResponder stores these closures and invokes them only after a native touch event.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => moveCallbacksRef.current.onMoveStart?.(),
        onPanResponderMove: (_event, gestureState) => {
          const context = moveContextRef.current;
          const screenDpToPt = context.pageWidthPt / (context.viewWidthDp * context.zoom);
          const maxXPt = Math.max(0, context.pageWidthPt - context.effectiveWidthPt);
          const maxYPt = Math.max(0, context.pageHeightPt - context.fontSizePt * 1.6);
          setDraftPosition({
            xPt: Math.min(maxXPt, Math.max(0, context.xPt + gestureState.dx * screenDpToPt)),
            yPt: Math.min(maxYPt, Math.max(0, context.yPt + gestureState.dy * screenDpToPt)),
          });
        },
        onPanResponderRelease: (_event, gestureState) => {
          const context = moveContextRef.current;
          const screenDpToPt = context.pageWidthPt / (context.viewWidthDp * context.zoom);
          const maxXPt = Math.max(0, context.pageWidthPt - context.effectiveWidthPt);
          const maxYPt = Math.max(0, context.pageHeightPt - context.fontSizePt * 1.6);
          const xPt = Math.min(maxXPt, Math.max(0, context.xPt + gestureState.dx * screenDpToPt));
          const yPt = Math.min(maxYPt, Math.max(0, context.yPt + gestureState.dy * screenDpToPt));
          moveCallbacksRef.current.onMove?.(xPt, yPt);
          setDraftPosition(null);
          moveCallbacksRef.current.onMoveEnd?.();
        },
        onPanResponderTerminate: () => {
          setDraftPosition(null);
          moveCallbacksRef.current.onMoveEnd?.();
        },
      }),
    [],
  );

  useEffect(() => {
    if (focused) {
      inputRef.current?.focus();
    } else {
      inputRef.current?.blur();
    }
  }, [focused]);

  const handleFocus = () => {
    const accepted = onFocus?.();
    if (accepted === false) {
      inputRef.current?.blur();
      return;
    }
    if (selectAllOnFocus && edit.text.length > 0) {
      requestAnimationFrame(() => {
        inputRef.current?.setSelection(0, edit.text.length);
      });
    }
  };

  return (
    <>
      <TextInput
        ref={inputRef}
        value={edit.text}
        onChangeText={onChangeText}
        onBlur={onBlur}
        onFocus={handleFocus}
        autoFocus={autoFocus}
        multiline
        scrollEnabled={false}
        allowFontScaling={false}
        selectionColor={colors.primary}
        style={[
          styles.input,
          {
            left: xDp,
            top: yDp,
            width: widthDp,
            fontSize: fontSizeDp,
            lineHeight: fontSizeDp,
            color: edit.color,
            fontFamily: edit.fontFamily,
            fontWeight: edit.fontWeight === 'bold' ? '700' : '400',
          },
          focused && styles.focused,
        ]}
      />
      {focused && onMove && (
        <View
          accessibilityRole="adjustable"
          accessibilityLabel="Move selected text box"
          style={[
            styles.moveHandle,
            {
              left: Math.max(2, Math.min(viewWidthDp - 74, xDp + widthDp - 72)),
              top: Math.max(2, yDp - 31),
            },
          ]}
          {...moveResponder.panHandlers}
        >
          <Text style={styles.moveHandleText}>✥ Move</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    includeFontPadding: false,
    position: 'absolute',
    padding: 0,
    margin: 0,
    minWidth: 40,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    zIndex: 4,
  },
  focused: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  moveHandle: {
    position: 'absolute',
    zIndex: 12,
    height: 27,
    minWidth: 70,
    paddingHorizontal: 9,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  moveHandleText: {
    color: colors.textOnPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
});
