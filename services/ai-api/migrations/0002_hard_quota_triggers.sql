CREATE TRIGGER IF NOT EXISTS quota_jobs_daily_limit
BEFORE INSERT ON quota_jobs
WHEN NOT EXISTS (
  SELECT 1 FROM quota_jobs
  WHERE actor_id = NEW.actor_id AND usage_day = NEW.usage_day AND job_id = NEW.job_id
) AND (
  SELECT COUNT(*) FROM quota_jobs
  WHERE actor_id = NEW.actor_id AND usage_day = NEW.usage_day
) >= 2
BEGIN
  SELECT RAISE(ABORT, 'quota_documents_exhausted');
END;

CREATE TRIGGER IF NOT EXISTS quota_pages_daily_limit
BEFORE INSERT ON quota_pages
WHEN NOT EXISTS (
  SELECT 1 FROM quota_pages
  WHERE actor_id = NEW.actor_id AND usage_day = NEW.usage_day
    AND job_id = NEW.job_id AND page_number = NEW.page_number
) AND (
  SELECT COUNT(*) FROM quota_pages
  WHERE actor_id = NEW.actor_id AND usage_day = NEW.usage_day
) >= 50
BEGIN
  SELECT RAISE(ABORT, 'quota_pages_exhausted');
END;
