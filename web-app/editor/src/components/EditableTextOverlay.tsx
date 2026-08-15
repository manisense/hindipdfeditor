import { useEffect, useLayoutEffect, useRef } from 'react';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import {
  resizeTextAreaToContent,
  TEXT_LINE_HEIGHT,
  TEXT_OVERFLOW_WRAP,
} from '../lib/textLayout';
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

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    resizeTextAreaToContent(input);
  }, [edit.fontFamily, edit.fontWeight, edit.text, fontSizePx, widthPx]);

  useEffect(() => {
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled && inputRef.current) {
        resizeTextAreaToContent(inputRef.current);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [edit.fontFamily, edit.fontWeight, edit.text, fontSizePx, widthPx]);

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
    if (!focused) {
      const accepted = onFocus?.();
      if (accepted === false) {
        inputRef.current?.blur();
        return;
      }
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
      data-edit-id={edit.id}
      value={edit.text}
      onChange={(e) => onChangeText(e.target.value)}
      onMouseDown={(event) => {
        // Native focus happens before click. Activating an old edit also reveals
        // the formatting toolbar above the page, so focusing here would move the
        // textarea out from under the pointer before the click is dispatched.
        if (!focused) event.preventDefault();
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (!focused) handleFocus();
      }}
      onBlur={onBlur}
      onFocus={handleFocus}
      className={`editable-text-overlay ${focused ? 'editable-text-overlay--focused' : ''}`}
      style={{
        left: xDp,
        top: yDp,
        fontSize: fontSizePx,
        lineHeight: TEXT_LINE_HEIGHT,
        overflowWrap: TEXT_OVERFLOW_WRAP,
        color: edit.color,
        fontFamily: edit.fontFamily,
        fontWeight: edit.fontWeight === 'bold' ? 700 : 400,
        width: widthPx,
      }}
      rows={1}
    />
  );
}
