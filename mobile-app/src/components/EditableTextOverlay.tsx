import { useEffect, useRef } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import { colors } from '../theme';
import type { TextEdit } from '../state/editStore';

type Props = {
  edit: TextEdit;
  /** The `PdfPageViewer`'s currently measured width, in dp - see that component's docstring. */
  viewWidthDp: number;
  /** The source page's width, in PDF points. */
  pageWidthPt: number;
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
  onChangeText,
  autoFocus,
  selectAllOnFocus,
  focused,
  onBlur,
  onFocus,
}: Props) {
  const inputRef = useRef<TextInput>(null);
  const { xDp, yDp } = ptToDp(edit.xPt, edit.yPt, viewWidthDp, pageWidthPt);
  const fontSizeDp = edit.fontSizePt * (viewWidthDp / pageWidthPt);
  const widthDp =
    edit.widthPt === undefined
      ? undefined
      : ptSizeToDp(edit.widthPt, 0, viewWidthDp, pageWidthPt).wDp;

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
    <TextInput
      ref={inputRef}
      value={edit.text}
      onChangeText={onChangeText}
      onBlur={onBlur}
      onFocus={handleFocus}
      autoFocus={autoFocus}
      multiline
      style={[
        styles.input,
        {
          left: xDp,
          top: yDp,
          fontSize: fontSizeDp,
          lineHeight: fontSizeDp,
          color: edit.color,
          fontFamily: edit.fontFamily,
          fontWeight: edit.fontWeight === 'bold' ? '700' : '400',
        },
        widthDp !== undefined && { width: widthDp },
        focused && styles.focused,
      ]}
    />
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
  },
  focused: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
