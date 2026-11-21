import { describe, expect, it } from 'vitest';

import { textEditFragmentHtml } from './htmlCompositor';
import type { TextEdit } from '../state/editStore';

const edit: TextEdit = {
  id: 'text-1',
  type: 'text',
  page: 0,
  xPt: 10,
  yPt: 10,
  widthPt: 40,
  text: 'धर्म क्षेत्र long translation',
  fontSizePt: 12,
  fontFamily: 'NotoSansDevanagari',
  fontWeight: 'normal',
  color: '#111111',
};

describe('textEditFragmentHtml', () => {
  it('uses unclipped font metrics and wrapping that matches the live editor', () => {
    const html = textEditFragmentHtml(edit, 'f0');
    expect(html).toContain('line-height:normal');
    expect(html).toContain('overflow-wrap:break-word');
    expect(html).toContain('overflow:visible');
    expect(html).toContain('font-size:48px'); // 12 pt × 4 px/pt
    expect(html).toContain('width:160px');
    expect(textEditFragmentHtml({ ...edit, fontStyle: 'italic', fontWeight: 'bold' }, 'f2')).toContain(
      'font-weight:700;font-style:italic;',
    );
  });

  it('escapes typed text and rejects unsafe style values', () => {
    const html = textEditFragmentHtml(
      { ...edit, text: '<img src=x onerror=alert(1)>', color: 'red;background:url(x)', fontFamily: "x';}" },
      'f1',
    );
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('color:#111111');
    expect(html).toContain("font-family:'NotoSansDevanagari', system-ui");
  });
});
