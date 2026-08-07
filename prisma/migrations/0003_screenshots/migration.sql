CREATE TABLE "Screenshot" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "objectKey" VARCHAR(1024) NOT NULL,
  "caption" VARCHAR(500),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Screenshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Screenshot_objectKey_key" ON "Screenshot"("objectKey");
CREATE INDEX "Screenshot_projectId_sortOrder_idx" ON "Screenshot"("projectId", "sortOrder");
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Screenshot" ADD CONSTRAINT "Screenshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
