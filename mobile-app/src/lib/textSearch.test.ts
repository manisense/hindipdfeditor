import { findMatches, searchOrder } from './textSearch';

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
