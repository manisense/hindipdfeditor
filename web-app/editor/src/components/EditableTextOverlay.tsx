import { useEffect, useRef } from 'react';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import type { TextEdit } from '../state/editStore';
import './EditableTextOverlay.css';

type Props = {
  edit: TextEdit;
  viewWidthPx: number;
  pageWidthPt: number;
  onChangeText: (text: string) => void;
  autoFocus?: boolean;
  selectAllOnFocus?: boolean;
  focused?: boolean;
  onBlur?: () => void;
  onFocus?: () => boolean | void;
};

export function EditableTextOverlay({
  edit,
  viewWidthPx,
  pageWidthPt,
  onChangeText,
  autoFocus,
  selectAllOnFocus,
  focused,
  onBlur,
  onFocus,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { xDp, yDp } = ptToDp(edit.xPt, edit.yPt, viewWidthPx, pageWidthPt);
  const fontSizePx = edit.fontSizePt * (viewWidthPx / pageWidthPt);
  const widthPx =
    edit.widthPt === undefined
      ? undefined
      : ptSizeToDp(edit.widthPt, 0, viewWidthPx, pageWidthPt).wDp;

  useEffect(() => {
    if (focused) {
      inputRef.current?.focus();
    } else {
      inputRef.current?.blur();
    }
  }, [focused]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleFocus = () => {
    const accepted = onFocus?.();
    if (accepted === false) {
      inputRef.current?.blur();
      return;
    }
    if (selectAllOnFocus && edit.text.length > 0) {
      requestAnimationFrame(() => {
        inputRef.current?.select();
      });
    }
  };

  return (
    <textarea
      ref={inputRef}
      value={edit.text}
      onChange={(e) => onChangeText(e.target.value)}
      onBlur={onBlur}
      onFocus={handleFocus}
      className={`editable-text-overlay ${focused ? 'editable-text-overlay--focused' : ''}`}
      style={{
        left: xDp,
        top: yDp,
        fontSize: fontSizePx,
        lineHeight: `${fontSizePx}px`,
        color: edit.color,
        fontFamily: edit.fontFamily,
        fontWeight: edit.fontWeight === 'bold' ? 700 : 400,
        width: widthPx,
      }}
      rows={1}
    />
  );
}
