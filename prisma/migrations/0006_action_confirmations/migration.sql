-- High-risk mutations consume a short-lived, server-side confirmation token.
-- Tokens are scoped to one account, action, and resource and cannot be reused.
CREATE TABLE "ActionConfirmation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "resourceType" VARCHAR(80) NOT NULL,
    "resourceId" VARCHAR(120) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionConfirmation_tokenHash_key" ON "ActionConfirmation"("tokenHash");
CREATE INDEX "ActionConfirmation_accountId_action_resourceType_resourceId_expiresAt_idx"
  ON "ActionConfirmation"("accountId", "action", "resourceType", "resourceId", "expiresAt");

ALTER TABLE "ActionConfirmation"
  ADD CONSTRAINT "ActionConfirmation_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
