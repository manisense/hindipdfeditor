-- Raise the anonymous daily document ceiling from 2 to 10 (AI_LIMITS.anonymousDocumentsPerDay).
-- The 50 pages per day ceiling is unchanged and remains the cost cap.
DROP TRIGGER IF EXISTS quota_jobs_daily_limit;

CREATE TRIGGER quota_jobs_daily_limit
BEFORE INSERT ON quota_jobs
WHEN NOT EXISTS (
  SELECT 1 FROM quota_jobs
  WHERE actor_id = NEW.actor_id AND usage_day = NEW.usage_day AND job_id = NEW.job_id
) AND (
  SELECT COUNT(*) FROM quota_jobs
  WHERE actor_id = NEW.actor_id AND usage_day = NEW.usage_day
) >= 10
BEGIN
  SELECT RAISE(ABORT, 'quota_documents_exhausted');
END;
