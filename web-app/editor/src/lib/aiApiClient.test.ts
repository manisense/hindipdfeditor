import { createAiApiClient } from "./aiApiClient";

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("web AI API client", () => {
  it("uses Turnstile for a web session and never sends a Gemini key", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        json({
          version: 1,
          token: "session",
          expiresAt: "2999-01-01T00:00:00Z",
        }),
      )
      .mockResolvedValueOnce(
        json({
          version: 1,
          requestId: "request",
          model: "gemini-3.5-flash",
          results: [
            { id: "1", translatedText: "नमस्ते", status: "translated" },
          ],
        }),
      );
    const client = createAiApiClient({
      baseUrl: "https://api.test",
      fetchImpl,
      clientIdProvider: () => "web-client-1234567890",
      turnstileTokenProvider: () => "turnstile-token",
    });

    await client.translate("job", "en-hi", [
      { id: "1", page: 0, text: "Hello" },
    ]);

    const sessionBody = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(sessionBody).toMatchObject({
      platform: "web",
      turnstileToken: "turnstile-token",
    });
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toMatch(
      /gemini[_-]?api[_-]?key/iu,
    );
  });

  it("requires the security check before creating a session", async () => {
    const client = createAiApiClient({
      fetchImpl: vi.fn(),
      clientIdProvider: () => "web-client-1234567890",
    });
    await expect(
      client.translate("job", "hi-en", [{ id: "1", page: 0, text: "नमस्ते" }]),
    ).rejects.toThrow(/security check/u);
  });
});
