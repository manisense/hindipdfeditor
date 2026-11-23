import { describe, expect, it } from 'vitest';

import {
  autoFontSizePt,
  changedFields,
  cssColor,
  fitFontSizePt,
  fitWrappedFontSizePt,
  isLatinOnly,
  normaliseRect,
  placeInField,
  quarterTurn,
  sameRect,
  sameValue,
  type FormWidget,
} from './pdfForm';

const widget = (over: Partial<FormWidget>): FormWidget => ({
  id: '0:0',
  field: 'name',
  kind: 'text',
  page: 0,
  xPt: 0,
  yPt: 0,
  wPt: 100,
  hPt: 20,
  pdfRect: [0, 0, 100, 20],
  label: 'name',
  readOnly: false,
  multiline: false,
  align: 0,
  fontSizePt: 0,
  color: '#000000',
  textRotation: 0,
  initial: '',
  ...over,
});

describe('pdfForm helpers', () => {
  it('keeps Latin answers on the vector path and sends Hindi to the browser', () => {
    expect(isLatinOnly('Manish Kumar, 110001')).toBe(true);
    expect(isLatinOnly('Café\nline two')).toBe(true);
    expect(isLatinOnly('मनीष')).toBe(false);
    expect(isLatinOnly('Ram राम')).toBe(false);
    expect(isLatinOnly('₹500')).toBe(false);
  });

  it('sizes auto fonts from the field height', () => {
    expect(autoFontSizePt(20, false)).toBe(11);
    expect(autoFontSizePt(40, false)).toBe(12);
    expect(autoFontSizePt(4, false)).toBe(4);
    expect(autoFontSizePt(80, true)).toBe(10);
  });

  it('shrinks a long answer to the field', () => {
    expect(fitFontSizePt(12, 50, 15, 100, 20)).toBe(12);
    expect(fitFontSizePt(12, 192, 15, 100, 20)).toBeCloseTo(6);
    expect(fitFontSizePt(12, 50, 30, 100, 20)).toBeCloseTo(8);
    expect(fitFontSizePt(12, 5000, 15, 100, 20)).toBe(4);
  });

  it('shrinks wrapped answers that overflow their field', () => {
    expect(fitWrappedFontSizePt(10, 30, 40)).toBe(10);
    expect(fitWrappedFontSizePt(51, 360, 61)).toBeCloseTo(51 * Math.sqrt(57 / 360) * 0.95);
    expect(fitWrappedFontSizePt(5, 1000, 20)).toBe(4);
  });

  it('places answers by alignment', () => {
    const field = { wPt: 100, hPt: 20 };
    expect(placeInField(field, { wPt: 40, hPt: 10 }, 0, false)).toEqual({ xPt: 2, yPt: 5 });
    expect(placeInField(field, { wPt: 40, hPt: 10 }, 1, false)).toEqual({ xPt: 30, yPt: 5 });
    expect(placeInField(field, { wPt: 40, hPt: 10 }, 2, false)).toEqual({ xPt: 58, yPt: 5 });
    expect(placeInField(field, { wPt: 96, hPt: 40 }, 0, true)).toEqual({ xPt: 2, yPt: 2 });
  });

  it('matches widget rectangles', () => {
    expect(normaliseRect([10, 30, 5, 20])).toEqual([5, 20, 10, 30]);
    expect(sameRect([0, 0, 10, 10], [0.2, 0, 10, 10.4])).toBe(true);
    expect(sameRect([0, 0, 10, 10], [1, 0, 10, 10])).toBe(false);
  });

  it('turns appearance colours into CSS', () => {
    expect(cssColor([0, 0, 255])).toBe('#0000ff');
    expect(cssColor(null)).toBe('#000000');
  });

  it('reports only fields the user changed', () => {
    const widgets = [
      widget({ field: 'name', initial: '' }),
      widget({ id: '0:1', field: 'agree', kind: 'checkbox', initial: false }),
      widget({ id: '0:2', field: 'locked', readOnly: true, initial: 'x' }),
    ];
    const changed = changedFields(widgets, { name: 'राम', agree: false, locked: 'y' });
    expect([...changed]).toEqual([['name', 'राम']]);
  });

  it('compares list box selections by content', () => {
    expect(sameValue(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameValue(['a'], ['a', 'b'])).toBe(false);
    expect(sameValue('a', 'a')).toBe(true);
    const widgets = [widget({ field: 'langs', kind: 'list', initial: ['a'] })];
    expect(changedFields(widgets, { langs: ['a'] }).size).toBe(0);
    expect([...changedFields(widgets, { langs: ['a', 'b'] })]).toEqual([['langs', ['a', 'b']]]);
  });

  it('reduces angles to quarter turns', () => {
    expect(quarterTurn(0)).toBe(0);
    expect(quarterTurn(-90)).toBe(270);
    expect(quarterTurn(450)).toBe(90);
    expect(quarterTurn(45)).toBe(0);
  });
});
