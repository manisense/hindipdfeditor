import { aiApiClient } from './aiApiClient';
import { containsDevanagari, containsLatin, translateOcrLines } from './geminiTranslate';

jest.mock('./aiApiClient', () => ({
  aiApiClient: { translate: jest.fn() },
}));

describe('translation source detection', () => {
  it('detects Devanagari and Latin independently', () => {
    expect(containsDevanagari('नमस्ते PDF')).toBe(true);
    expect(containsLatin('नमस्ते PDF')).toBe(true);
    expect(containsDevanagari('English only')).toBe(false);
    expect(containsLatin('हिन्दी मात्र')).toBe(false);
  });

  it('batches long pages at the shared API limit and preserves line IDs', async () => {
    const translate = aiApiClient.translate as jest.MockedFunction<typeof aiApiClient.translate>;
    translate.mockImplementation(async (_jobId, _direction, lines) => ({
      version: 1,
      requestId: 'request',
      model: 'model',
      results: lines.map((line) => ({
        id: line.id,
        translatedText: `T:${line.text}`,
        status: 'translated',
      })),
    }));
    const lines = Array.from({ length: 41 }, (_, index) => ({
      id: `line-${index}`,
      page: 0,
      text: `source-${index}`,
    }));

    const translated = await translateOcrLines('job', 'en-hi', lines);

    expect(translate).toHaveBeenCalledTimes(2);
    expect(translated.get('line-40')).toBe('T:source-40');
  });
});
