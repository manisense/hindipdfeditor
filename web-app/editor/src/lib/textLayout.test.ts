import { describe, expect, it } from 'vitest';

import {
  resizeTextAreaToContent,
  TEXT_LINE_HEIGHT,
  TEXT_OVERFLOW_WRAP,
} from './textLayout';

describe('shared text layout', () => {
  it('uses font-native vertical metrics and safe word wrapping', () => {
    expect(TEXT_LINE_HEIGHT).toBe('normal');
    expect(TEXT_OVERFLOW_WRAP).toBe('break-word');
  });

  it('sets the editor height to its full scroll height', () => {
    const textArea = document.createElement('textarea');
    Object.defineProperty(textArea, 'scrollHeight', { configurable: true, value: 64 });

    resizeTextAreaToContent(textArea);

    expect(textArea.style.height).toBe('64px');
  });
});
