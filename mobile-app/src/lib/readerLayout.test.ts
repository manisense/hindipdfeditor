import {
  A4_ASPECT,
  createThrottle,
  currentPageAt,
  isWithin,
  keepNear,
  nextPageToRender,
  pageAtOffset,
  readerPageLayout,
} from './readerLayout';

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

describe('pageAtOffset', () => {
  const offsets = [80, 186, 292];
  it('finds the page whose top is at or above the probe', () => {
    expect(pageAtOffset(offsets, 0)).toBe(0);
    expect(pageAtOffset(offsets, 185)).toBe(0);
    expect(pageAtOffset(offsets, 186)).toBe(1);
    expect(pageAtOffset(offsets, 10_000)).toBe(2);
  });
});

describe('currentPageAt', () => {
  // Landscape tablet: pages taller than the 800dp viewport would need 40% item visibility.
  const { offsets } = readerPageLayout(5, {}, 1280, 72, 6);
  const content = offsets[4] + 1280 / A4_ASPECT + 6 + 100;
  it('follows the scroll position on screens where no page is 40% visible', () => {
    expect(currentPageAt(offsets, 0, 800, content, 72)).toBe(0);
    expect(currentPageAt(offsets, offsets[2] - 72, 800, content, 72)).toBe(2);
  });
  it('is the last page at the end of the list', () => {
    expect(currentPageAt(offsets, content - 800, 800, content, 72)).toBe(4);
  });
  it('is 0 for an empty file', () => {
    expect(currentPageAt([], 0, 800, 0, 72)).toBe(0);
  });
});

describe('nextPageToRender', () => {
  it('goes center, after, before', () => {
    const done = new Set<number>();
    const order: number[] = [];
    for (let p = nextPageToRender(5, 10, 1, (x) => done.has(x)); p !== null;) {
      order.push(p);
      done.add(p);
      p = nextPageToRender(5, 10, 1, (x) => done.has(x));
    }
    expect(order).toEqual([5, 6, 4]);
  });
  it('stays inside the file', () => {
    expect(nextPageToRender(0, 1, 1, (p) => p === 0)).toBeNull();
    expect(nextPageToRender(0, 2, 1, (p) => p === 0)).toBe(1);
  });
});

describe('keepNear', () => {
  it('drops pages further than the radius', () => {
    expect(keepNear({ 0: 'a', 3: 'b', 5: 'c', 6: 'd', 9: 'e' }, 5, 2)).toEqual({
      3: 'b',
      5: 'c',
      6: 'd',
    });
    expect(isWithin(7, 5, 1)).toBe(false);
  });
});
