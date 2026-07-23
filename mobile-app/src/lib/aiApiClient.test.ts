import { AI_API_VERSION } from '@hindipdfeditor/translation-contract';

import { createAiApiClient } from './aiApiClient';

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('AI API client', () => {
  it('creates an anonymous session and sends translation without exposing a Gemini key', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        response({
          version: AI_API_VERSION,
          token: 'signed-session',
          expiresAt: '2999-01-01T00:00:00Z',
        }),
      )
      .mockResolvedValueOnce(
        response({
          version: AI_API_VERSION,
          requestId: 'server-request',
          model: 'gemini-3.5-flash',
          results: [{ id: 'line-1', translatedText: 'Hello', status: 'translated' }],
        }),
      );
    const client = createAiApiClient({
      baseUrl: 'https://api.example.test/',
      fetchImpl,
      clientIdProvider: async () => 'android-client-id-123456',
    });

    const result = await client.translate('job-1', 'hi-en', [
      { id: 'line-1', page: 0, text: 'नमस्ते' },
    ]);

    expect(result.results[0]?.translatedText).toBe('Hello');
    const sessionBody = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    const translationBody = JSON.parse(fetchImpl.mock.calls[1][1].body as string);
    expect(sessionBody).toMatchObject({
      platform: 'android',
      clientId: 'android-client-id-123456',
    });
    expect(fetchImpl.mock.calls[1][1].headers).toMatchObject({
      Authorization: 'Bearer signed-session',
    });
    expect(JSON.stringify({ sessionBody, translationBody })).not.toMatch(/api[_-]?key/iu);
  });

  it('refreshes an expired server session once after a 401', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        response({ version: AI_API_VERSION, token: 'old', expiresAt: '2999-01-01T00:00:00Z' }),
      )
      .mockResolvedValueOnce(response({ error: { message: 'expired' } }, 401))
      .mockResolvedValueOnce(
        response({ version: AI_API_VERSION, token: 'new', expiresAt: '2999-01-01T00:00:00Z' }),
      )
      .mockResolvedValueOnce(
        response({ version: AI_API_VERSION, requestId: 'r', model: 'm', results: [] }),
      );
    const client = createAiApiClient({
      fetchImpl,
      clientIdProvider: async () => 'client-1234567890123456',
    });
    await client.translate('job', 'en-hi', [{ id: '1', page: 0, text: 'Hello' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it('surfaces the public API error message', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        response({ version: AI_API_VERSION, token: 'token', expiresAt: '2999-01-01T00:00:00Z' }),
      )
      .mockResolvedValueOnce(
        response({ error: { message: 'The free daily AI limit has been reached.' } }, 429),
      );
    const client = createAiApiClient({
      fetchImpl,
      clientIdProvider: async () => 'client-1234567890123456',
    });
    await expect(
      client.translate('job', 'hi-en', [{ id: '1', page: 0, text: 'नमस्ते' }]),
    ).rejects.toThrow(/daily AI limit/u);
  });
});
