-- A project is owned by either one account or one organization, never both
-- and never neither. Application authorization relies on this invariant.
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_exactly_one_owner_check"
  CHECK (("ownerAccountId" IS NOT NULL) <> ("ownerOrganizationId" IS NOT NULL));

ALTER TABLE "File"
  ADD CONSTRAINT "File_positive_size_check"
  CHECK ("size" > 0),
  ADD CONSTRAINT "File_nonnegative_downloads_check"
  CHECK ("downloads" >= 0);

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_nonnegative_counters_check"
  CHECK ("downloadCount" >= 0 AND "followerCount" >= 0 AND "favoriteCount" >= 0);

-- PostgreSQL's trigram index accelerates the allow-listed ILIKE/contains
-- predicates used by the catalogue without accepting raw sort/search SQL.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Project_name_trgm_idx" ON "Project" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Project_slug_trgm_idx" ON "Project" USING GIN ("slug" gin_trgm_ops);
