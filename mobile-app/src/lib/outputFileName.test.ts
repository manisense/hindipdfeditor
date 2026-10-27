import { MAX_BASE_NAME_BYTES, outputFileName, truncateUtf8 } from './outputFileName';

describe('outputFileName', () => {
  it('removes path separators and unsafe characters and appends .pdf once', () => {
    expect(outputFileName('../secret/नया:file', 'x')).toBe('secret-नया-file.pdf');
    expect(outputFileName('report.pdf', 'x')).toBe('report.pdf');
    expect(outputFileName('a\\b', 'x')).toBe('a-b.pdf');
  });

  it('falls back when the typed name is empty', () => {
    expect(outputFileName('   ', 'letter-edited')).toBe('letter-edited.pdf');
    expect(outputFileName('', '')).toBe('document.pdf');
  });
});

const utf8Bytes = (text: string) => new TextEncoder().encode(text).length;

describe('long file names', () => {
  it('caps a long Devanagari name by UTF-8 bytes without splitting a cluster', () => {
    const long = 'प्रमाणपत्र क्षेत्रीय कार्यालय '.repeat(8);
    const name = outputFileName(long, 'x');
    const base = name.replace(/\.pdf$/, '');
    expect(name.endsWith('.pdf')).toBe(true);
    expect(utf8Bytes(base)).toBeLessThanOrEqual(MAX_BASE_NAME_BYTES);
    expect(utf8Bytes(`${base} (99).pdf`)).toBeLessThanOrEqual(255);
    expect(long.startsWith(base)).toBe(true);
    expect(base).not.toMatch(/[\u093e-\u094d\u200c\u200d]$/);
    expect(long.slice(base.length)).not.toMatch(/^[\u093a-\u094f]/);
  });

  it('backs off from a virama and from a following matra', () => {
    // क्ष = क + ् + ष (9 bytes); cutting at 6 bytes would end on the virama.
    expect(truncateUtf8('कक्ष', 9)).toBe('क');
    // कि = क + ि; cutting after क would leave the matra behind.
    expect(truncateUtf8('ककि', 6)).toBe('क');
    expect(truncateUtf8('abc', 10)).toBe('abc');
  });
});
