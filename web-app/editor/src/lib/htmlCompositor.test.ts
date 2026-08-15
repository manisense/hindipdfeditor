import { describe, expect, it } from 'vitest';

import { pageHtml } from './htmlCompositor';
import type { PageState } from '../state/editStore';

describe('pageHtml text layout', () => {
  it('uses unclipped font metrics and wrapping that matches the live editor', () => {
    const page: PageState = {
      pageIndex: 0,
      widthPt: 100,
      heightPt: 100,
      backgroundImageUri: 'data:image/png;base64,AA==',
      imagePxWidth: 200,
      imagePxHeight: 200,
      ocrLines: [],
      edits: [
        {
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
        },
      ],
    };

    const html = pageHtml(page, page.backgroundImageUri);

    expect(html).toContain('line-height:normal');
    expect(html).toContain('overflow-wrap:break-word');
    expect(html).toContain('overflow:visible');
    expect(html).not.toContain('line-height:1.15');
  });
});
