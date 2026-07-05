import { TextInput, StyleSheet } from 'react-native';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
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
  onBlur?: () => void;
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
  onBlur,
}: Props) {
  const { xDp, yDp } = ptToDp(edit.xPt, edit.yPt, viewWidthDp, pageWidthPt);
  const fontSizeDp = edit.fontSizePt * (viewWidthDp / pageWidthPt);
  // An OCR-assisted replacement carries the detected line's width so the input wraps at the
  // same point the exported HTML will (see TextEdit.widthPt's docstring); freely-placed new
  // text has no width and stays a single growing line, the original Phase 1 behavior.
  const widthDp =
    edit.widthPt === undefined
      ? undefined
      : ptSizeToDp(edit.widthPt, 0, viewWidthDp, pageWidthPt).wDp;

  return (
    <TextInput
      value={edit.text}
      onChangeText={onChangeText}
      onBlur={onBlur}
      autoFocus={autoFocus}
      multiline
      style={[
        styles.input,
        {
          left: xDp,
          top: yDp,
          fontSize: fontSizeDp,
          color: edit.color,
          fontFamily: edit.fontFamily,
        },
        widthDp !== undefined && { width: widthDp },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    position: 'absolute',
    padding: 0,
    margin: 0,
    minWidth: 40,
    backgroundColor: 'transparent',
  },
});
