-- A report has exactly one target, and the nullable foreign-key column must
-- agree with the discriminator. This keeps malformed rows from bypassing
-- moderation queries when clients send more than one target id.
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_exactly_one_target_check"
  CHECK (
    ("projectId" IS NOT NULL)::int +
    ("releaseId" IS NOT NULL)::int +
    ("fileId" IS NOT NULL)::int +
    ("commentId" IS NOT NULL)::int +
    ("accountId" IS NOT NULL)::int = 1
  ),
  ADD CONSTRAINT "Report_target_type_matches_column_check"
  CHECK (
    ("targetType" = 'PROJECT' AND "projectId" IS NOT NULL) OR
    ("targetType" = 'RELEASE' AND "releaseId" IS NOT NULL) OR
    ("targetType" = 'FILE' AND "fileId" IS NOT NULL) OR
    ("targetType" = 'COMMENT' AND "commentId" IS NOT NULL) OR
    ("targetType" = 'ACCOUNT' AND "accountId" IS NOT NULL)
  );
