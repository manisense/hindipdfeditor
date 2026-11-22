import { expect, it } from 'vitest';

import { nextOcrPage } from './ocrQueue';

it('reads the page on screen first, then the pages after it, then the ones before', () => {
  const done = new Set([5]);
  expect(nextOcrPage(10, 3, (i) => !done.has(i))).toBe(3);
  done.add(3);
  expect(nextOcrPage(10, 3, (i) => !done.has(i))).toBe(4);
  for (let i = 4; i < 10; i++) done.add(i);
  expect(nextOcrPage(10, 3, (i) => !done.has(i))).toBe(0);
  for (let i = 0; i < 3; i++) done.add(i);
  expect(nextOcrPage(10, 3, (i) => !done.has(i))).toBeNull();
});
