import { containsDevanagari, parseGeminiTranslateResponse } from './geminiTranslate';

describe('containsDevanagari', () => {
  it('detects Devanagari code points', () => {
    expect(containsDevanagari('नमस्ते')).toBe(true);
    expect(containsDevanagari('Hello नमस्ते')).toBe(true);
    expect(containsDevanagari('Hello')).toBe(false);
    expect(containsDevanagari('')).toBe(false);
  });
});

describe('parseGeminiTranslateResponse', () => {
  it('parses a JSON array of English strings', () => {
    const response = {
      candidates: [
        {
          content: {
            parts: [{ text: '["Hello","World"]' }],
          },
        },
      ],
    };
    expect(parseGeminiTranslateResponse(response, 2)).toEqual(['Hello', 'World']);
  });

  it('rejects length mismatches', () => {
    const response = {
      candidates: [{ content: { parts: [{ text: '["only-one"]' }] } }],
    };
    expect(() => parseGeminiTranslateResponse(response, 2)).toThrow(/length mismatch/);
  });
});
