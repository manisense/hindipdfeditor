import { useEffect, useLayoutEffect, useRef } from 'react';

import { ptSizeToDp, ptToDp } from '../lib/coordinateMath';
import { cssFontStack } from '../lib/fontAsset';
import { transliterateBeforeCaret } from '../lib/romanToHindi';
import {
  resizeTextAreaToContent,
  TEXT_LINE_HEIGHT,
  TEXT_OVERFLOW_WRAP,
} from '../lib/textLayout';
import type { TextEdit } from '../state/editStore';
import './EditableTextOverlay.css';
import { cssWeight } from '../lib/fontWeight';

type Props = {
  edit: TextEdit;
  viewWidthPx: number;
  pageWidthPt: number;
  onChangeText: (text: string) => void;
  /** Convert each English-letter word to Hindi when a space or punctuation follows it. */
  romanTyping?: boolean;
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
  romanTyping,
  autoFocus,
  selectAllOnFocus,
  focused,
  onBlur,
  onFocus,
}: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** Caret after the user's last change, restored if the text then grows elsewhere (paragraph flow). */
  const caretRef = useRef<number | null>(null);
  /**
   * Where the next typed letter goes, while the user keeps typing. Typing a virama before a
   * consonant joins the two into one cluster, and browsers will not leave the caret inside a
   * cluster: they move it past the whole cluster, so the next letters land in the following
   * word. Typed letters are therefore inserted here instead; clicks and other keys reset it.
   */
  const typedCaretRef = useRef<number | null>(null);
  const onChangeTextRef = useRef(onChangeText);
  onChangeTextRef.current = onChangeText;
  const romanTypingRef = useRef(romanTyping);
  romanTypingRef.current = romanTyping;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const onBeforeInput = (event: InputEvent) => {
      if (event.inputType !== 'insertText' || !event.data || event.isComposing) return;
      event.preventDefault();
      const tracked = typedCaretRef.current;
      const start = tracked ?? input.selectionStart;
      const end = tracked ?? input.selectionEnd;
      let text = input.value.slice(0, start) + event.data + input.value.slice(end);
      let caret = start + event.data.length;
      const converted = romanTypingRef.current ? transliterateBeforeCaret(text, caret) : null;
      if (converted) {
        text = converted.value;
        caret = converted.caret;
      }
      typedCaretRef.current = caret;
      caretRef.current = caret;
      onChangeTextRef.current(text);
    };
    const reset = () => {
      typedCaretRef.current = null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) reset();
    };
    input.addEventListener('beforeinput', onBeforeInput);
    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('mousedown', reset);
    input.addEventListener('touchstart', reset);
    input.addEventListener('blur', reset);
    return () => {
      input.removeEventListener('beforeinput', onBeforeInput);
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('mousedown', reset);
      input.removeEventListener('touchstart', reset);
      input.removeEventListener('blur', reset);
    };
  }, []);
  const { xDp, yDp } = ptToDp(edit.xPt, edit.yPt, viewWidthPx, pageWidthPt);
  const fontSizePx = edit.fontSizePt * (viewWidthPx / pageWidthPt);
  const widthPx =
    edit.widthPt === undefined
      ? undefined
      : ptSizeToDp(edit.widthPt, 0, viewWidthPx, pageWidthPt).wDp;

  useLayoutEffect(() => {
    const input = inputRef.current;
    const caret = caretRef.current;
    caretRef.current = null;
    if (!input || caret === null || document.activeElement !== input) return;
    if (input.selectionStart !== caret) input.setSelectionRange(caret, caret);
  }, [edit.text]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    resizeTextAreaToContent(input);
  }, [edit.fontFamily, edit.fontWeight, edit.fontStyle, edit.lineHeightPt, edit.text, fontSizePx, widthPx]);

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
  }, [edit.fontFamily, edit.fontWeight, edit.fontStyle, edit.text, fontSizePx, widthPx]);

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
      onChange={(e) => {
        // Deletion, paste, line breaks and IME input (typed letters are inserted above).
        const field = e.target;
        typedCaretRef.current = null;
        caretRef.current = field.selectionStart;
        const converted = romanTyping
          ? transliterateBeforeCaret(field.value, field.selectionStart ?? field.value.length)
          : null;
        if (!converted) {
          onChangeText(field.value);
          return;
        }
        onChangeText(converted.value);
        requestAnimationFrame(() => field.setSelectionRange(converted.caret, converted.caret));
      }}
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
        lineHeight: edit.lineHeightPt === undefined ? TEXT_LINE_HEIGHT : `${edit.lineHeightPt * (viewWidthPx / pageWidthPt)}px`,
        overflowWrap: TEXT_OVERFLOW_WRAP,
        color: edit.color,
        fontFamily: cssFontStack(edit.fontFamily),
        fontWeight: cssWeight(edit.fontWeight),
        fontStyle: edit.fontStyle ?? 'normal',
        ...(edit.strokeEm ? { WebkitTextStroke: `${edit.strokeEm * fontSizePx}px ${edit.color}` } : {}),
        // Squeezed to the original's width from the left edge; laid out unscaled, so wider.
        ...(edit.scaleX && edit.scaleX !== 1 ? { transform: `scaleX(${edit.scaleX})`, transformOrigin: '0 0' } : {}),
        width: widthPx === undefined ? undefined : widthPx / (edit.scaleX ?? 1),
      }}
      rows={1}
    />
  );
}
