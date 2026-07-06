import { findOcrLineAt, findOcrTargetAt, findTextEditAt } from './ocrHitTest';
import type { OcrLine, TextEdit } from '../state/editStore';

function ocrLine(id: string, xPt: number, yPt: number, wPt = 100, hPt = 12): OcrLine {
  return { id, text: id, xPt, yPt, wPt, hPt };
}

function textEdit(
  id: string,
  xPt: number,
  yPt: number,
  text = 'hello',
  fontSizePt = 12,
  widthPt?: number,
): TextEdit {
  return {
    type: 'text',
    id,
    page: 0,
    xPt,
    yPt,
    fontSizePt,
    text,
    color: '#111',
    fontFamily: 'NotoSansDevanagari',
    ...(widthPt !== undefined ? { widthPt } : {}),
  };
}

describe('findOcrLineAt', () => {
  it('returns null when no lines exist', () => {
    expect(findOcrLineAt([], 50, 50)).toBeNull();
  });

  it('returns null for a tap on empty page space', () => {
    expect(findOcrLineAt([ocrLine('a', 10, 10)], 500, 500)).toBeNull();
  });

  it('finds the line containing the tap', () => {
    const line = ocrLine('a', 10, 10);
    expect(findOcrLineAt([line], 50, 15)).toBe(line);
  });

  it('honors the tolerance just outside a box edge', () => {
    const line = ocrLine('a', 10, 10);
    // 5pt above the top edge - inside the default 8pt tolerance.
    expect(findOcrLineAt([line], 50, 5)).toBe(line);
    // 15pt above - outside it.
    expect(findOcrLineAt([line], 50, -5)).toBeNull();
  });

  it('prefers the smallest box when boxes overlap', () => {
    const big = ocrLine('big', 0, 0, 400, 50);
    const small = ocrLine('small', 10, 10, 80, 12);
    expect(findOcrLineAt([big, small], 20, 15)).toBe(small);
  });

  it('supports zero tolerance', () => {
    const line = ocrLine('a', 10, 10);
    expect(findOcrLineAt([line], 9, 15, 0)).toBeNull();
    expect(findOcrLineAt([line], 10, 15, 0)).toBe(line);
  });
});

describe('findOcrTargetAt', () => {
  it('returns a direct hit when inside tolerance', () => {
    const line = ocrLine('a', 10, 10);
    expect(findOcrTargetAt([line], 50, 15)).toBe(line);
  });

  it('snaps to the nearest line when the tap is just outside the box', () => {
    const line = ocrLine('a', 10, 10, 80, 12);
    // 15pt below the box bottom (y=22) - outside 8pt tolerance but inside 28pt snap.
    expect(findOcrLineAt([line], 50, 37)).toBeNull();
    expect(findOcrTargetAt([line], 50, 37)).toBe(line);
  });

  it('returns null when nothing is near enough to snap', () => {
    const line = ocrLine('a', 10, 10);
    expect(findOcrTargetAt([line], 500, 500)).toBeNull();
  });
});

describe('findTextEditAt', () => {
  it('finds a committed text edit under the tap', () => {
    const edit = textEdit('e1', 10, 10, 'नमस्ते', 14, 60);
    expect(findTextEditAt([edit], 30, 15)).toBe(edit);
  });

  it('returns null when tapping empty space', () => {
    expect(findTextEditAt([textEdit('e1', 10, 10)], 500, 500)).toBeNull();
  });
});
