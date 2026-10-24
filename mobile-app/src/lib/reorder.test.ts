import { moveItem } from './reorder';

describe('moveItem', () => {
  it('moves an item down', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });
  it('moves an item up', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });
  it('returns a copy when from equals to', () => {
    const list = ['a'];
    expect(moveItem(list, 0, 0)).not.toBe(list);
  });
  it('clamps out-of-range targets', () => {
    expect(moveItem(['a', 'b'], 0, 9)).toEqual(['b', 'a']);
  });
});
