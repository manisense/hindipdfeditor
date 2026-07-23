import { AI_LIMITS } from "@hindipdfeditor/translation-contract";

import { ApiError } from "./errors";

export type QuotaSnapshot = { documents: number; pages: number };

export interface QuotaStore {
  reserve(
    actorId: string,
    usageDay: string,
    jobId: string,
    pages: number[],
  ): Promise<QuotaSnapshot>;
}

function changes(result: D1Result): number {
  return typeof result.meta?.changes === "number" ? result.meta.changes : 0;
}

function asQuotaError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/quota_(documents|pages)_exhausted/u.test(message)) {
    throw new ApiError(
      "QUOTA_EXHAUSTED",
      "The free daily AI limit has been reached.",
      429,
    );
  }
  throw error;
}

export class D1QuotaStore implements QuotaStore {
  constructor(private readonly db: D1Database) {}

  async reserve(
    actorId: string,
    usageDay: string,
    jobId: string,
    pages: number[],
  ): Promise<QuotaSnapshot> {
    const newPages: number[] = [];
    const jobInsert = await this.db
      .prepare(
        "INSERT OR IGNORE INTO quota_jobs (actor_id, usage_day, job_id) VALUES (?, ?, ?)",
      )
      .bind(actorId, usageDay, jobId)
      .run()
      .catch(asQuotaError);
    const newJob = changes(jobInsert) > 0;
    for (const page of [...new Set(pages)]) {
      const result = await this.db
        .prepare(
          "INSERT OR IGNORE INTO quota_pages (actor_id, usage_day, job_id, page_number) VALUES (?, ?, ?, ?)",
        )
        .bind(actorId, usageDay, jobId, page)
        .run()
        .catch(asQuotaError);
      if (changes(result) > 0) newPages.push(page);
    }

    const documentCount = await this.db
      .prepare(
        "SELECT COUNT(*) AS count FROM quota_jobs WHERE actor_id = ? AND usage_day = ?",
      )
      .bind(actorId, usageDay)
      .first<{ count: number }>();
    const pageCount = await this.db
      .prepare(
        "SELECT COUNT(*) AS count FROM quota_pages WHERE actor_id = ? AND usage_day = ?",
      )
      .bind(actorId, usageDay)
      .first<{ count: number }>();
    const snapshot = {
      documents: Number(documentCount?.count ?? 0),
      pages: Number(pageCount?.count ?? 0),
    };
    if (
      snapshot.documents > AI_LIMITS.anonymousDocumentsPerDay ||
      snapshot.pages > AI_LIMITS.anonymousPagesPerDay
    ) {
      for (const page of newPages) {
        await this.db
          .prepare(
            "DELETE FROM quota_pages WHERE actor_id = ? AND usage_day = ? AND job_id = ? AND page_number = ?",
          )
          .bind(actorId, usageDay, jobId, page)
          .run();
      }
      if (newJob) {
        await this.db
          .prepare(
            "DELETE FROM quota_jobs WHERE actor_id = ? AND usage_day = ? AND job_id = ?",
          )
          .bind(actorId, usageDay, jobId)
          .run();
      }
      throw new ApiError(
        "QUOTA_EXHAUSTED",
        "The free daily AI limit has been reached.",
        429,
      );
    }
    return snapshot;
  }
}

export async function deleteExpiredQuotaRows(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare(
      "DELETE FROM quota_pages WHERE usage_day < date('now', '-8 days')",
    ),
    db.prepare(
      "DELETE FROM quota_jobs WHERE usage_day < date('now', '-8 days')",
    ),
  ]);
}

export class MemoryQuotaStore implements QuotaStore {
  private readonly jobs = new Set<string>();
  private readonly pages = new Set<string>();

  async reserve(
    actorId: string,
    usageDay: string,
    jobId: string,
    pages: number[],
  ): Promise<QuotaSnapshot> {
    const prefix = `${actorId}:${usageDay}:`;
    const jobKey = `${prefix}${jobId}`;
    const nextJobs = new Set(this.jobs).add(jobKey);
    const nextPages = new Set(this.pages);
    for (const page of pages) nextPages.add(`${jobKey}:${page}`);
    const documents = [...nextJobs].filter((key) =>
      key.startsWith(prefix),
    ).length;
    const pageCount = [...nextPages].filter((key) =>
      key.startsWith(prefix),
    ).length;
    if (
      documents > AI_LIMITS.anonymousDocumentsPerDay ||
      pageCount > AI_LIMITS.anonymousPagesPerDay
    ) {
      throw new ApiError(
        "QUOTA_EXHAUSTED",
        "The free daily AI limit has been reached.",
        429,
      );
    }
    this.jobs.add(jobKey);
    for (const page of pages) this.pages.add(`${jobKey}:${page}`);
    return { documents, pages: pageCount };
  }
}
