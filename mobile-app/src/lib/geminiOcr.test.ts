import { parseGeminiOcrResponse } from './geminiOcr';

/** Wraps a model-emitted JSON string in the generateContent response envelope. */
function envelope(modelText: string): unknown {
  return { candidates: [{ content: { parts: [{ text: modelText }] } }] };
}

describe('parseGeminiOcrResponse', () => {
  // box_2d is [ymin, xmin, ymax, xmax] normalized to 0-1000; image is 2000x1000 px, so the
  // descale factor is x2 horizontally and x1 vertically.
  const valid = JSON.stringify([
    { text: 'छुट्टी की अर्जी का फॉर्म', box_2d: [100, 250, 150, 750] },
    { text: 'FORM OF APPLICATION FOR LEAVE', box_2d: [160, 200, 200, 800] },
  ]);

  it('descales box_2d from 0-1000 into image px using each axis dimension', () => {
    const lines = parseGeminiOcrResponse(envelope(valid), 2000, 1000);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      text: 'छुट्टी की अर्जी का फॉर्म',
      x: 500, // 250/1000 * 2000
      y: 100, // 100/1000 * 1000
      width: 1000, // (750-250)/1000 * 2000
      height: 50, // (150-100)/1000 * 1000
    });
  });

  it('tolerates a markdown-fenced JSON body', () => {
    const lines = parseGeminiOcrResponse(envelope('```json\n' + valid + '\n```'), 2000, 1000);
    expect(lines).toHaveLength(2);
  });

  it('joins multi-part responses before parsing', () => {
    const half = valid.length >> 1;
    const multiPart = {
      candidates: [
        { content: { parts: [{ text: valid.slice(0, half) }, { text: valid.slice(half) }] } },
      ],
    };
    expect(parseGeminiOcrResponse(multiPart, 2000, 1000)).toHaveLength(2);
  });

  it('skips entries with empty text or degenerate boxes without throwing', () => {
    const body = JSON.stringify([
      { text: '', box_2d: [0, 0, 10, 10] },
      { text: 'ok', box_2d: [10, 10, 10, 20] }, // zero height
      { text: 'kept', box_2d: [0, 0, 100, 100] },
    ]);
    const lines = parseGeminiOcrResponse(envelope(body), 1000, 1000);
    expect(lines.map((l) => l.text)).toEqual(['kept']);
  });

  it('throws on an API error payload', () => {
    expect(() =>
      parseGeminiOcrResponse({ error: { message: 'API key not valid' } }, 1000, 1000),
    ).toThrow(/API key not valid/);
  });

  it('throws on an empty response', () => {
    expect(() => parseGeminiOcrResponse({ candidates: [] }, 1000, 1000)).toThrow(/no text/);
  });

  it('throws on non-JSON model output', () => {
    expect(() =>
      parseGeminiOcrResponse(envelope('I could not read the image.'), 1000, 1000),
    ).toThrow(/not valid JSON/);
  });

  it('throws on a JSON object that is not an array', () => {
    expect(() => parseGeminiOcrResponse(envelope('{"text":"x"}'), 1000, 1000)).toThrow(
      /not an array/,
    );
  });

  it('throws on a malformed box_2d rather than guessing', () => {
    const body = JSON.stringify([{ text: 'x', box_2d: [1, 2, 3] }]);
    expect(() => parseGeminiOcrResponse(envelope(body), 1000, 1000)).toThrow(/box_2d/);
  });
});
