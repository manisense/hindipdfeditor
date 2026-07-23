import {
  AI_API_VERSION,
  AI_LIMITS,
  parseTranslationRequest,
  parseTranslationResponse,
  sourceLanguage,
  targetLanguage,
  type TranslationRequest,
} from '@hindipdfeditor/translation-contract';

const request: TranslationRequest = {
  version: AI_API_VERSION,
  requestId: 'request-1',
  jobId: 'job-1',
  direction: 'hi-en',
  lines: [
    { id: 'page-0-line-1', page: 0, text: 'भारत सरकार' },
    { id: 'page-0-line-2', page: 0, text: 'कर्मचारी का नाम', contextBefore: 'भारत सरकार' },
  ],
};

describe('translation contract', () => {
  it('maps translation directions to source and target languages', () => {
    expect(sourceLanguage('hi-en')).toBe('hi');
    expect(targetLanguage('hi-en')).toBe('en');
    expect(sourceLanguage('en-hi')).toBe('en');
    expect(targetLanguage('en-hi')).toBe('hi');
  });

  it('accepts a valid request and preserves stable line IDs', () => {
    expect(parseTranslationRequest(request)).toEqual(request);
  });

  it('rejects duplicate request line IDs', () => {
    expect(() =>
      parseTranslationRequest({
        ...request,
        lines: [request.lines[0], request.lines[0]],
      }),
    ).toThrow(/duplicate line id/);
  });

  it('rejects requests above the line limit', () => {
    expect(() =>
      parseTranslationRequest({
        ...request,
        lines: Array.from({ length: AI_LIMITS.maxLinesPerRequest + 1 }, (_, index) => ({
          id: `line-${index}`,
          page: 0,
          text: 'परीक्षण',
        })),
      }),
    ).toThrow(/line limit/);
  });

  it('accepts a complete response even when results return out of order', () => {
    expect(
      parseTranslationResponse(
        {
          version: AI_API_VERSION,
          requestId: request.requestId,
          model: 'test-model',
          results: [
            { id: 'page-0-line-2', translatedText: 'Employee name', status: 'translated' },
            { id: 'page-0-line-1', translatedText: 'Government of India', status: 'translated' },
          ],
        },
        request,
      ).results,
    ).toHaveLength(2);
  });

  it('rejects missing, duplicate, unexpected, and empty translated results', () => {
    expect(() =>
      parseTranslationResponse(
        {
          version: AI_API_VERSION,
          requestId: request.requestId,
          model: 'test-model',
          results: [
            { id: 'page-0-line-1', translatedText: 'Government of India', status: 'translated' },
          ],
        },
        request,
      ),
    ).toThrow(/count mismatch/);

    expect(() =>
      parseTranslationResponse(
        {
          version: AI_API_VERSION,
          requestId: request.requestId,
          model: 'test-model',
          results: [
            { id: 'page-0-line-1', translatedText: 'Government', status: 'translated' },
            { id: 'page-0-line-1', translatedText: 'India', status: 'translated' },
          ],
        },
        request,
      ),
    ).toThrow(/duplicate result id/);

    expect(() =>
      parseTranslationResponse(
        {
          version: AI_API_VERSION,
          requestId: request.requestId,
          model: 'test-model',
          results: [
            { id: 'page-0-line-1', translatedText: 'Government', status: 'translated' },
            { id: 'unexpected', translatedText: 'India', status: 'translated' },
          ],
        },
        request,
      ),
    ).toThrow(/unexpected result id/);

    expect(() =>
      parseTranslationResponse(
        {
          version: AI_API_VERSION,
          requestId: request.requestId,
          model: 'test-model',
          results: [
            { id: 'page-0-line-1', translatedText: '', status: 'translated' },
            { id: 'page-0-line-2', translatedText: 'Employee name', status: 'translated' },
          ],
        },
        request,
      ),
    ).toThrow(/must contain text/);
  });
});
