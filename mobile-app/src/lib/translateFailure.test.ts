import { AiServiceError } from './aiApiClient';
import { classifyTranslateFailure, NoTextFoundError, TextDetectionError } from './translateFailure';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'id' }));
jest.mock('expo-file-system/legacy', () => ({}));

describe('classifyTranslateFailure', () => {
  it('keeps a used-up daily limit apart from a lost connection', () => {
    expect(classifyTranslateFailure(new AiServiceError('limit', 'QUOTA_EXHAUSTED', false))).toBe(
      'quota',
    );
    expect(classifyTranslateFailure(new AiServiceError('offline', 'NETWORK', false))).toBe(
      'offline',
    );
    expect(classifyTranslateFailure(new AiServiceError('slow', 'TIMEOUT', false))).toBe('offline');
  });

  it('names a busy service apart from one that is down', () => {
    expect(classifyTranslateFailure(new AiServiceError('busy', 'RATE_LIMITED', true))).toBe('busy');
    expect(
      classifyTranslateFailure(new AiServiceError('down', 'TEMPORARILY_UNAVAILABLE', true)),
    ).toBe('unavailable');
    expect(classifyTranslateFailure(new AiServiceError('off', 'FEATURE_DISABLED', true))).toBe(
      'unavailable',
    );
  });

  it('reports pages that could not be read and documents with nothing to translate', () => {
    expect(classifyTranslateFailure(new TextDetectionError(2, new Error('ML Kit')))).toBe(
      'detection-failed',
    );
    expect(classifyTranslateFailure(new NoTextFoundError())).toBe('no-text');
  });

  it('treats anything unknown as the service being unavailable, not as offline', () => {
    expect(classifyTranslateFailure(new Error('boom'))).toBe('unavailable');
    expect(classifyTranslateFailure('boom')).toBe('unavailable');
  });
});
