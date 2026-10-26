import { A4_ASPECT, createThrottle, readerPageLayout } from './readerLayout';

describe('readerPageLayout', () => {
  it('stacks pages under the top padding with a gap after each', () => {
    const { heights, offsets } = readerPageLayout(3, { 0: { width: 100, height: 200 } }, 50, 80, 6);
    expect(heights).toEqual([100, 100, 100]);
    expect(offsets).toEqual([80, 186, 292]);
  });

  it('uses each rendered page its own ratio and the first known ratio for the rest', () => {
    const sizes = { 1: { width: 200, height: 100 }, 2: { width: 100, height: 100 } };
    const { heights } = readerPageLayout(3, sizes, 100, 0, 0);
    expect(heights).toEqual([50, 50, 100]);
  });

  it('falls back to A4 when nothing has rendered', () => {
    const { heights } = readerPageLayout(1, {}, 100, 0, 0);
    expect(heights[0]).toBeCloseTo(100 / A4_ASPECT);
  });

  it('ignores failed renders without a size', () => {
    const { heights } = readerPageLayout(2, { 0: {} }, 100, 0, 0);
    expect(heights[0]).toBeCloseTo(100 / A4_ASPECT);
  });
});

describe('createThrottle', () => {
  it('passes at most once per interval and skips repeats', () => {
    let t = 0;
    const throttle = createThrottle(50, () => t);
    expect(throttle.pass(1, false)).toBe(true);
    t = 20;
    expect(throttle.pass(2, false)).toBe(false);
    t = 50;
    expect(throttle.pass(2, false)).toBe(true);
    t = 200;
    expect(throttle.pass(2, false)).toBe(false);
  });

  it('lets a new value through when forced, and starts over after reset', () => {
    let t = 0;
    const throttle = createThrottle(50, () => t);
    throttle.pass(1, false);
    t = 10;
    expect(throttle.pass(3, true)).toBe(true);
    expect(throttle.pass(3, true)).toBe(false);
    throttle.reset();
    expect(throttle.pass(3, false)).toBe(true);
  });
});
