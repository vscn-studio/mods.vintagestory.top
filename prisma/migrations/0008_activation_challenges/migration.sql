CREATE TABLE "ActivationChallenge" (
    "id" VARCHAR(64) NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "subject" VARCHAR(320) NOT NULL,
    "bindEmail" VARCHAR(320) NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivationChallenge_provider_subject_bindEmail_key"
  ON "ActivationChallenge"("provider", "subject", "bindEmail");
CREATE INDEX "ActivationChallenge_expiresAt_idx"
  ON "ActivationChallenge"("expiresAt");
CREATE INDEX "ActivationChallenge_provider_subject_createdAt_idx"
  ON "ActivationChallenge"("provider", "subject", "createdAt");
