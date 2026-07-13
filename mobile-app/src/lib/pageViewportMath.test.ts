import { clampPageScroll } from './pageViewportMath';

describe('clampPageScroll', () => {
  it('allows horizontal and vertical movement across a zoomed page', () => {
    expect(clampPageScroll(320, 510, 2, 300, 400, 400, 600)).toEqual({ x: 320, y: 510 });
  });

  it('clamps both axes to the real zoomed page bounds', () => {
    expect(clampPageScroll(900, 1200, 2, 300, 400, 400, 600)).toEqual({ x: 500, y: 800 });
  });

  it('keeps fit-width horizontal position fixed while allowing tall-page vertical movement', () => {
    expect(clampPageScroll(40, 180, 1, 300, 400, 300, 600)).toEqual({ x: 0, y: 180 });
  });

  it('never returns negative content offsets', () => {
    expect(clampPageScroll(-20, -30, 3, 300, 400, 300, 600)).toEqual({ x: 0, y: 0 });
  });
});
