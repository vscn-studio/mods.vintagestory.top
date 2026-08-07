ALTER TABLE "Project"
  ADD COLUMN "downloadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "followerCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "favoriteCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "Project" p
SET "followerCount" = (SELECT COUNT(*)::integer FROM "Follow" f WHERE f."projectId" = p."id"),
    "favoriteCount" = (SELECT COUNT(*)::integer FROM "Favorite" f WHERE f."projectId" = p."id"),
    "downloadCount" = (SELECT COALESCE(SUM(f."downloads"), 0)::integer FROM "File" f JOIN "Release" r ON r."id" = f."releaseId" WHERE r."projectId" = p."id");
