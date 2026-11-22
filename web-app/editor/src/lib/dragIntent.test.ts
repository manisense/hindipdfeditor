import { describe, expect, it } from 'vitest';

import { isBoxDrag } from './dragIntent';

describe('isBoxDrag', () => {
  it('treats a click or a tiny wobble as a click', () => {
    expect(isBoxDrag(0, 0)).toBe(false);
    expect(isBoxDrag(8, 8)).toBe(false);
  });

  it('accepts a long thin box over one small line of text', () => {
    expect(isBoxDrag(250, 7)).toBe(true);
    expect(isBoxDrag(7, 60)).toBe(true);
  });

  it('rejects a line with no height', () => {
    expect(isBoxDrag(250, 2)).toBe(false);
  });
});
