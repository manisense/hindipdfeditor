import { describe, expect, it } from 'vitest';

import { minutesLeft } from './wakeLock';

describe('minutesLeft', () => {
  it('projects the pace so far onto the rest of the job', () => {
    expect(minutesLeft(60_000, 10, 110)).toBe(10);
    expect(minutesLeft(1_000, 10, 20)).toBe(1);
  });

  it('waits for a few units before estimating', () => {
    expect(minutesLeft(5_000, 2, 100)).toBeNull();
    expect(minutesLeft(5_000, 100, 100)).toBeNull();
  });
});
