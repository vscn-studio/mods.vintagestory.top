-- A release can have at most one active review task. The application already
-- serializes release transitions; this constraint also protects direct jobs
-- and future workers from enqueueing duplicates.
WITH duplicate_tasks AS (
  SELECT id,
         row_number() OVER (PARTITION BY "releaseId" ORDER BY "createdAt", id) AS duplicate_number
  FROM "ReviewTask"
  WHERE status = 'QUEUED' AND "releaseId" IS NOT NULL
)
UPDATE "ReviewTask" AS task
SET status = 'REJECTED',
    decision = COALESCE(task.decision, 'Duplicate review task superseded during migration.')
FROM duplicate_tasks
WHERE task.id = duplicate_tasks.id
  AND duplicate_tasks.duplicate_number > 1;

CREATE UNIQUE INDEX "ReviewTask_queued_release_unique_idx"
  ON "ReviewTask"("releaseId")
  WHERE status = 'QUEUED' AND "releaseId" IS NOT NULL;
