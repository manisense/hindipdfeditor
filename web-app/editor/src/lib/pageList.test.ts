import { describe, expect, it } from 'vitest';

import { parsePageList } from './pageList';

describe('parsePageList', () => {
  it('reads long ranges quickly and without repeats', () => {
    const result = parsePageList('1-2000, 5', 2000);
    expect('pages' in result && result.pages.length).toBe(2000);
  });
});
