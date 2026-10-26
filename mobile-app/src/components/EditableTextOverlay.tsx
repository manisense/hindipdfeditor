import { StyleSheet, TextInput } from 'react-native';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import type { TextEdit } from '../state/editStore';
import { ui } from '../ui/tokens';

type Props = {
  edit: TextEdit;
  /** The `PdfPageViewer`'s currently measured width, in dp - see that component's docstring. */
  viewWidthDp: number;
  /** The source page's width, in PDF points. */
  pageWidthPt: number;
  /** True for the line being changed in the line sheet: brand underline and tint. */
  focused?: boolean;
};

/**
 * Renders one `TextEdit` as an absolutely-positioned, read-only native `TextInput` on top of the
 * page's background image: the live preview of what the export will draw. Typing happens in the
 * editor's line sheet; this overlay ignores touches so taps reach `PdfPageViewer`. Because this
 * is a real native `TextInput`, Android's own text stack (HarfBuzz-backed since Android O)
 * shapes Devanagari correctly live - spec Section 8 - with zero custom shaping code here.
 *
 * Position and font size are both derived from the edit's stored PDF-point values via
 * `coordinateMath.ts`, using the same `viewWidthDp` the caller measured from `PdfPageViewer`,
 * so this overlay lines up with the same background image pixel that `htmlCompositor.ts`
 * will place it against at export time.
 */
export function EditableTextOverlay({ edit, viewWidthDp, pageWidthPt, focused }: Props) {
  const { xDp, yDp } = ptToDp(edit.xPt, edit.yPt, viewWidthDp, pageWidthPt);
  const fontSizeDp = edit.fontSizePt * (viewWidthDp / pageWidthPt);
  const desiredFallbackWidthPt = Math.max(120, pageWidthPt * 0.35);
  const availableWidthPt = Math.max(24, pageWidthPt - edit.xPt - 4);
  const effectiveWidthPt = edit.widthPt ?? Math.min(desiredFallbackWidthPt, availableWidthPt);
  const widthDp = ptSizeToDp(effectiveWidthPt, 0, viewWidthDp, pageWidthPt).wDp;

  const isLightText =
    edit.color.toUpperCase() === '#FFFFFF' || edit.color === 'white' || edit.color === '#fff';
  // Pages are always white, so the light brand tint suits both app themes.
  const focusBgColor = isLightText ? 'rgba(0,0,0,0.6)' : 'rgba(238,242,255,0.85)';

  return (
    <TextInput
      value={edit.text}
      editable={false}
      pointerEvents="none"
      importantForAccessibility="no"
      multiline
      scrollEnabled={false}
      allowFontScaling={false}
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
        focused && [styles.focused, { backgroundColor: focusBgColor }],
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
    textAlignVertical: 'top',
    zIndex: 4,
  },
  focused: {
    borderBottomWidth: 2,
    borderBottomColor: ui.brand,
  },
});
