/** Browser-native line height keeps each font's real ascent, descent, and Devanagari marks. */
export const TEXT_LINE_HEIGHT = 'normal' as const;

/** Wrap long translations without splitting normal words unless the box has no alternative. */
export const TEXT_OVERFLOW_WRAP = 'break-word' as const;

/**
 * Grows a live text editor to its complete rendered content height.
 *
 * The textarea must use `box-sizing: content-box` with zero padding/border so its CSS height
 * and `scrollHeight` describe the same content box.
 */
export function resizeTextAreaToContent(textArea: HTMLTextAreaElement): void {
  textArea.style.height = 'auto';
  textArea.style.height = `${textArea.scrollHeight}px`;
}
