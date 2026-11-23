import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadWithStallTimeout } from "./ocrLanguageData";

/** A response whose body sends `chunks`, waiting `gapMs` before each one. */
function slowResponse(chunks: number[][], gapMs: number): Response {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      await new Promise((resolve) => setTimeout(resolve, gapMs));
      if (index < chunks.length) controller.enqueue(new Uint8Array(chunks[index++]));
      else controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("downloadWithStallTimeout", () => {
  it("finishes a download that is slow overall but never stalls", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () => slowResponse([[1, 2], [3], [4, 5]], 900));
    const result = downloadWithStallTimeout("https://x/eng.traineddata.gz", 1000, fetchImpl as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(4000);
    await expect(result).resolves.toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it("fails when bytes stop arriving", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
          init?.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      });
      return new Response(body, { status: 200 });
    });
    const result = downloadWithStallTimeout("https://x/hin.traineddata.gz", 1000, fetchImpl as unknown as typeof fetch);
    const assertion = expect(result).rejects.toThrow("stopped downloading");
    await vi.advanceTimersByTimeAsync(1500);
    await assertion;
  });

  it("fails on an HTTP error", async () => {
    const fetchImpl = vi.fn(async () => new Response("missing", { status: 404 }));
    await expect(
      downloadWithStallTimeout("https://x/eng.traineddata.gz", 1000, fetchImpl as unknown as typeof fetch),
    ).rejects.toThrow("HTTP 404");
  });
});
