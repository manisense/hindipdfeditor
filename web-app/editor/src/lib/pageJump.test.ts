import { describe, expect, it } from 'vitest';

import { pageFromInput } from './pageJump';

describe('pageFromInput', () => {
  it('reads page numbers, Hindi digits too, kept inside the document', () => {
    expect(pageFromInput('3', 31)).toBe(2);
    expect(pageFromInput(' ३ ', 31)).toBe(2);
    expect(pageFromInput('99', 31)).toBe(30);
    expect(pageFromInput('0', 31)).toBe(0);
    expect(pageFromInput('abc', 31)).toBeNull();
    expect(pageFromInput('', 31)).toBeNull();
  });
});
