import { snapOffset } from './BrandBand';

describe('snapOffset', () => {
  it('opens the band when stopped in the first half of the collapse', () => {
    expect(snapOffset(30, 100)).toBe(0);
  });

  it('collapses the band when stopped in the second half', () => {
    expect(snapOffset(60, 100)).toBe(100);
  });

  it('leaves the list alone outside the collapse range', () => {
    expect(snapOffset(0, 100)).toBeNull();
    expect(snapOffset(100, 100)).toBeNull();
    expect(snapOffset(400, 100)).toBeNull();
    expect(snapOffset(50, 0)).toBeNull();
  });
});
