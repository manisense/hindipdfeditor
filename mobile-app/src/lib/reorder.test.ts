import { moveItem, moveSlot } from './reorder';

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

describe('moveSlot', () => {
  const start = { a: 0, b: 1, c: 2 };
  it('moves a row down and shifts the rows it passes up', () => {
    expect(moveSlot(start, 'a', 2)).toEqual({ a: 2, b: 0, c: 1 });
  });
  it('moves a row up and shifts the rows it passes down', () => {
    expect(moveSlot(start, 'c', 0)).toEqual({ a: 1, b: 2, c: 0 });
  });
  it('matches moveItem for the same move', () => {
    const order = moveItem(['a', 'b', 'c'], 1, 2);
    const slots = moveSlot(start, 'b', 2);
    expect(order.map((k) => slots[k])).toEqual([0, 1, 2]);
  });
  it('does not change the input map', () => {
    moveSlot(start, 'a', 1);
    expect(start).toEqual({ a: 0, b: 1, c: 2 });
  });
});
