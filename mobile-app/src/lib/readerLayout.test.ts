import { createThrottle, isWithin, keepNear, nextPageToRender } from './readerLayout';

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
