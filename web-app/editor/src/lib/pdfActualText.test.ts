import { describe, expect, it } from 'vitest';

import { applyActualText, drawnGlyphs, markedContentStarts, type MarkedContentOps } from './pdfActualText';

const NUL = String.fromCharCode(0);
const OPS: MarkedContentOps = { showText: 1, beginMarkedContent: 2, beginMarkedContentProps: 3, endMarkedContent: 4 };

describe('markedContentStarts', () => {
  it('reads each BDC tag and its ActualText (UTF-16 hex), in order', () => {
    const content = [
      '/Span<</ActualText <FEFF0927094D092F093E> >> BDC <33> Tj EMC',
      '/OC /oc1 BDC <4C> Tj EMC',
      '/Span <</MCID 3 /ActualText (Hi)>> BDC (x) Tj EMC',
    ].join('\n');
    expect(markedContentStarts(content)).toEqual([
      { tag: 'Span', actualText: 'ध्या' },
      { tag: 'OC', actualText: null },
      { tag: 'Span', actualText: 'Hi' },
    ]);
  });
});

describe('drawnGlyphs', () => {
  const glyph = (unicode: string) => ({ unicode });

  it('marks glyphs inside an ActualText section, nested sections included', () => {
    const fnArray = [1, 3, 1, 2, 1, 4, 4, 1];
    const argsArray = [[[glyph('अ')]], ['Span', null], [[glyph(NUL), 12, glyph('ा')]], ['P'], [[glyph('x')]], null, null, [[glyph('य')]]];
    expect(drawnGlyphs(fnArray, argsArray, [{ tag: 'Span', actualText: 'ध्या' }], OPS)).toEqual([
      { text: 'अ', section: null },
      { text: NUL, section: 0 },
      { text: 'ा', section: 0 },
      { text: 'x', section: 0 },
      { text: 'य', section: null },
    ]);
  });

  it('gives up when the sections do not match the content stream', () => {
    expect(drawnGlyphs([3, 4], [['Span', null], null], [{ tag: 'OC', actualText: null }], OPS)).toBeNull();
    expect(drawnGlyphs([3, 4], [['Span', null], null], [], OPS)).toBeNull();
  });
});

describe('applyActualText', () => {
  it('puts each section text in place of its glyphs, across items and around added spaces', () => {
    // अध्याय drawn as अ, [ध्य (unmapped), ा] in a span, य; the span's glyphs fall in two items.
    const glyphs = [
      { text: 'अ', section: null },
      { text: NUL, section: 0 },
      { text: 'ा', section: 0 },
      { text: 'य', section: null },
      { text: ' ', section: null },
      { text: '1', section: null },
    ];
    const result = applyActualText([`अ${NUL}`, 'ाय', ' ', '1'], glyphs, ['ध्या']);
    expect(result?.items.join('')).toBe('अध्याय 1');
    expect(result?.replaced).toEqual([true]);
  });

  it('keeps sections without unmapped glyphs and reports unmapped glyphs it could not replace', () => {
    const glyphs = [
      { text: 'क', section: 0 },
      { text: NUL, section: null },
    ];
    const result = applyActualText([`क${NUL}`], glyphs, ['ख']);
    expect(result?.items).toEqual([`क${NUL}`]);
    expect(result?.replaced).toEqual([false]);
  });

  it('lines up ligature glyphs that pdf.js decomposed in its text', () => {
    const glyphs = [
      { text: 'ﬁ', section: null },
      { text: 'le ', section: null },
      { text: NUL, section: 0 },
    ];
    expect(applyActualText(['file', ' ', NUL], glyphs, ['धर्म'])?.items).toEqual(['file', ' ', 'धर्म']);
  });

  it('removes spaces pdf.js added inside Hindi words when the page draws its spaces', () => {
    const glyphs = [...'शिक्षा नीति'].map((text) => ({ text, section: null }));
    expect(applyActualText(['शि', ' ', 'क्षा', ' ', 'नीति'], glyphs, [])?.items.join('')).toBe('शिक्षा नीति');
    // Without drawn spaces, pdf.js's spaces are the only word breaks and stay.
    const unspaced = [...'शिक्षानीति'].map((text) => ({ text, section: null }));
    expect(applyActualText(['शि', ' ', 'क्षा'], unspaced.slice(0, 6), [])?.items.join('')).toBe('शि क्षा');
  });

  it('gives up when the glyphs do not match the items', () => {
    expect(applyActualText(['abc'], [{ text: 'x', section: 0 }, { text: NUL, section: 0 }], ['y'])).toBeNull();
  });
});
