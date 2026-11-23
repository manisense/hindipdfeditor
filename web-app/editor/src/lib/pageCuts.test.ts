import { describe, expect, it } from 'vitest';

import { pageCuts } from './pageCuts';

describe('pageCuts', () => {
  it('keeps a section that fits as one page', () => {
    expect(pageCuts(new Array(90).fill(true), 100)).toEqual([[0, 90]]);
  });

  it('cuts a tall section in a blank row near the page bottom, not through text', () => {
    const blank = new Array(250).fill(false);
    for (const y of [92, 93, 94, 180]) blank[y] = true;
    expect(pageCuts(blank, 100)).toEqual([
      [0, 95],
      [95, 181],
      [181, 250],
    ]);
  });

  it('cuts at the page height when no blank row is close enough', () => {
    expect(pageCuts(new Array(210).fill(false), 100)).toEqual([
      [0, 100],
      [100, 200],
      [200, 210],
    ]);
  });
});
