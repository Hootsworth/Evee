-- Allow interactive workers to claim only their active organization's jobs.
-- Cron workers pass NULL to continue processing all organizations.

DROP FUNCTION IF EXISTS claim_background_jobs(TEXT, INT, INT);

CREATE OR REPLACE FUNCTION claim_background_jobs(
  p_worker_id TEXT,
  p_batch_size INT DEFAULT 5,
  p_lock_timeout_seconds INT DEFAULT 300,
  p_organization_id UUID DEFAULT NULL
)
RETURNS SETOF background_jobs AS $$
BEGIN
  RETURN QUERY
  UPDATE background_jobs
  SET
    status = 'running',
    locked_at = timezone('utc', now()),
    locked_by = p_worker_id,
    heartbeat_at = timezone('utc', now()),
    attempt_count = attempt_count + 1,
    updated_at = timezone('utc', now())
  WHERE id IN (
    SELECT id
    FROM background_jobs
    WHERE (
      (status = 'queued' AND scheduled_at <= timezone('utc', now()))
      OR (status = 'running' AND locked_at < timezone('utc', now()) - (p_lock_timeout_seconds || ' seconds')::interval)
    )
    AND (p_organization_id IS NULL OR organization_id = p_organization_id)
    ORDER BY priority DESC, scheduled_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;
