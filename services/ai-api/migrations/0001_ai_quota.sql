CREATE TABLE IF NOT EXISTS quota_jobs (
  actor_id TEXT NOT NULL,
  usage_day TEXT NOT NULL,
  job_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (actor_id, usage_day, job_id)
);

CREATE TABLE IF NOT EXISTS quota_pages (
  actor_id TEXT NOT NULL,
  usage_day TEXT NOT NULL,
  job_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (actor_id, usage_day, job_id, page_number)
);

CREATE INDEX IF NOT EXISTS quota_jobs_day_actor ON quota_jobs (usage_day, actor_id);
CREATE INDEX IF NOT EXISTS quota_pages_day_actor ON quota_pages (usage_day, actor_id);
