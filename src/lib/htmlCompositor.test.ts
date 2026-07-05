import { documentHtml, escapeHtml, pageHtml } from './htmlCompositor';
import type { DocumentState, MaskEdit, PageState, TextEdit } from '../state/editStore';

function makePage(overrides: Partial<PageState> = {}): PageState {
  return {
    pageIndex: 0,
    widthPt: 595,
    heightPt: 842,
    backgroundImageUri: 'file:///fake/page-0.png',
    imagePxWidth: 1190,
    imagePxHeight: 1684,
    edits: [],
    ...overrides,
  };
}

function makeTextEdit(overrides: Partial<TextEdit> = {}): TextEdit {
  return {
    type: 'text',
    id: 't1',
    page: 0,
    xPt: 10,
    yPt: 20,
    fontSizePt: 14,
    text: 'धर्म',
    color: '#111111',
    fontFamily: 'NotoSansDevanagari',
    ...overrides,
  };
}

function makeMaskEdit(overrides: Partial<MaskEdit> = {}): MaskEdit {
  return {
    type: 'mask',
    id: 'm1',
    page: 0,
    xPt: 5,
    yPt: 5,
    wPt: 50,
    hPt: 10,
    color: '#ffffff',
    ...overrides,
  };
}

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
    );
  });

  it('leaves plain Devanagari text untouched', () => {
    expect(escapeHtml('धर्म और क्षेत्र')).toBe('धर्म और क्षेत्र');
  });

  it('neutralizes an onerror image-injection attempt', () => {
    const malicious = `<img src=x onerror="alert(1)">`;
    const escaped = escapeHtml(malicious);
    expect(escaped).not.toContain('<img');
    expect(escaped).not.toContain('>');
  });
});

describe('pageHtml', () => {
  it('renders the background image with the page pixel dimensions', () => {
    const html = pageHtml(makePage());
    expect(html).toContain("background-image:url('file:///fake/page-0.png')");
    expect(html).toContain('width:1190px');
    expect(html).toContain('height:1684px');
  });

  it('positions a text edit using ptToImagePx-derived pixel coordinates', () => {
    // scale = 1190 / 595 = 2 -> xPt 10 -> 20px, yPt 20 -> 40px, fontSizePt 14 -> 28px
    const html = pageHtml(makePage({ edits: [makeTextEdit()] }));
    expect(html).toContain('left:20px');
    expect(html).toContain('top:40px');
    expect(html).toContain('font-size:28px');
    expect(html).toContain('धर्म');
  });

  it('escapes a text edit body before interpolating it', () => {
    const html = pageHtml(makePage({ edits: [makeTextEdit({ text: '<script>evil()</script>' })] }));
    expect(html).not.toContain('<script>evil()</script>');
    expect(html).toContain('&lt;script&gt;evil()&lt;/script&gt;');
  });

  it('renders a mask edit as a filled div at its scaled position and size', () => {
    // scale = 2 -> xPt 5 -> 10px, yPt 5 -> 10px, wPt 50 -> 100px, hPt 10 -> 20px
    const html = pageHtml(makePage({ edits: [makeMaskEdit()] }));
    expect(html).toContain('left:10px');
    expect(html).toContain('top:10px');
    expect(html).toContain('width:100px');
    expect(html).toContain('height:20px');
    expect(html).toContain('background:#ffffff');
  });

  it('always renders masks before text in DOM order, regardless of edits array order', () => {
    const html = pageHtml(
      makePage({
        edits: [makeTextEdit({ id: 't1', text: 'बाद में' }), makeMaskEdit({ id: 'm1' })],
      }),
    );
    const maskIndex = html.indexOf('background:#ffffff');
    const textIndex = html.indexOf('बाद में');
    expect(maskIndex).toBeGreaterThanOrEqual(0);
    expect(textIndex).toBeGreaterThan(maskIndex);
  });

  it('renders a page with no edits as just the background layer', () => {
    const html = pageHtml(makePage());
    expect(html).not.toContain('<span');
    expect(html).not.toContain('<div style="position:absolute');
  });
});

describe('documentHtml', () => {
  function makeDocument(pages: PageState[]): DocumentState {
    return {
      sourceUri: 'file:///fake/source.pdf',
      pageCount: pages.length,
      pages,
      legacyFontWarnings: [],
    };
  }

  it('embeds the given base64 font data in an @font-face rule', () => {
    const html = documentHtml(makeDocument([makePage()]), 'ZmFrZS1mb250LWJhc2U2NA==');
    expect(html).toContain('@font-face');
    expect(html).toContain('data:font/ttf;base64,ZmFrZS1mb250LWJhc2U2NA==');
    expect(html).toContain('font-weight: 100 900');
  });

  it('renders one page block per page in the document, including unedited pages', () => {
    const html = documentHtml(
      makeDocument([
        makePage({ backgroundImageUri: 'file:///p0.png' }),
        makePage({ backgroundImageUri: 'file:///p1.png' }),
      ]),
      'Zm9udA==',
    );
    expect(html).toContain('file:///p0.png');
    expect(html).toContain('file:///p1.png');
  });

  it('inserts a page-break before every page except the first', () => {
    const html = documentHtml(makeDocument([makePage(), makePage(), makePage()]), 'Zm9udA==');
    expect(html.match(/page-break-before:always/g)).toHaveLength(2);
  });

  it('produces well-formed html/head/body structure', () => {
    const html = documentHtml(makeDocument([makePage()]), 'Zm9udA==');
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="hi">');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });
});
