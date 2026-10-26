import { findMatches, indexOfMatch, matchKeyAt, searchOrder, stepMatch } from './textSearch';

const pages = [
  { pageIndex: 0, lines: ['कई ज़िलों में प्रशिक्षण शिविर', 'Training camps were held'] },
  { pageIndex: 2, lines: ['पंचायत स्तर पर स्वयंसेवकों का प्रशिक्षण'] },
];

describe('findMatches', () => {
  it('finds Devanagari matches across pages', () => {
    const r = findMatches(pages, 'प्रशिक्षण');
    expect(r.map((m) => [m.pageIndex, m.lineIndex])).toEqual([
      [0, 0],
      [2, 0],
    ]);
    expect(r[0]).toMatchObject({ before: 'कई ज़िलों में ', match: 'प्रशिक्षण', after: ' शिविर' });
  });
  it('matches Latin text case-insensitively', () => {
    expect(findMatches(pages, 'training')).toHaveLength(1);
  });
  it('normalises nukta forms so ज़ matches ज़', () => {
    expect(findMatches(pages, 'ज़िलों'.normalize('NFD'))).toHaveLength(1);
  });
  it('returns nothing for blank queries', () => {
    expect(findMatches(pages, '  ')).toEqual([]);
  });
});

describe('searchOrder', () => {
  it('starts at the current page and works outward', () => {
    expect(searchOrder(2, 5)).toEqual([2, 3, 1, 4, 0]);
  });
  it('clamps a start page outside the file', () => {
    expect(searchOrder(9, 3)).toEqual([2, 1, 0]);
    expect(searchOrder(0, 0)).toEqual([]);
  });
});

describe('match keys', () => {
  const lines = [{ pageIndex: 4, lines: ['ab ab'] }];
  const late = findMatches(lines, 'ab');
  const all = findMatches([{ pageIndex: 1, lines: ['ab'] }, ...lines], 'ab');

  it('keeps pointing at the same match when earlier pages add results', () => {
    const key = matchKeyAt(late, 1);
    expect(key).toEqual({ pageIndex: 4, lineIndex: 0, occurrence: 1 });
    expect(indexOfMatch(all, key)).toBe(2);
  });
  it('returns -1 for a missing or null key', () => {
    expect(indexOfMatch(all, null)).toBe(-1);
    expect(indexOfMatch(all, { pageIndex: 9, lineIndex: 0, occurrence: 0 })).toBe(-1);
  });
  it('steps next and previous from the key, wrapping around', () => {
    const key = matchKeyAt(all, 2);
    expect(stepMatch(all, key, 1)).toEqual({ pageIndex: 1, lineIndex: 0, occurrence: 0 });
    expect(stepMatch(all, key, -1)).toEqual({ pageIndex: 4, lineIndex: 0, occurrence: 0 });
  });
  it('starts from the first or last match without a key, and gives null with no matches', () => {
    expect(stepMatch(all, null, 1)).toEqual(matchKeyAt(all, 0));
    expect(stepMatch(all, null, -1)).toEqual(matchKeyAt(all, 2));
    expect(stepMatch([], null, 1)).toBeNull();
  });
});
