import { AI_LIMITS } from "@hindipdfeditor/translation-contract";
import { describe, expect, it } from "vitest";

import { MemoryQuotaStore } from "../src/quota";

describe("anonymous daily quota", () => {
  it("deduplicates retries for one job and page", async () => {
    const store = new MemoryQuotaStore();
    await expect(
      store.reserve("actor", "2026-07-22", "job-1", [0, 0]),
    ).resolves.toEqual({
      documents: 1,
      pages: 1,
    });
    await expect(
      store.reserve("actor", "2026-07-22", "job-1", [0]),
    ).resolves.toEqual({
      documents: 1,
      pages: 1,
    });
  });

  it("enforces document and page limits without recording rejected usage", async () => {
    const store = new MemoryQuotaStore();
    await store.reserve("actor", "2026-07-22", "job-1", [0]);
    await store.reserve("actor", "2026-07-22", "job-2", [0]);
    await expect(
      store.reserve("actor", "2026-07-22", "job-3", [0]),
    ).rejects.toMatchObject({
      code: "QUOTA_EXHAUSTED",
    });

    const pageStore = new MemoryQuotaStore();
    await pageStore.reserve(
      "actor",
      "2026-07-22",
      "job-1",
      Array.from(
        { length: AI_LIMITS.anonymousPagesPerDay },
        (_, index) => index,
      ),
    );
    await expect(
      pageStore.reserve("actor", "2026-07-22", "job-1", [
        AI_LIMITS.anonymousPagesPerDay,
      ]),
    ).rejects.toMatchObject({ code: "QUOTA_EXHAUSTED" });
  });
});
