-- Binding emails are compared case-insensitively by the authentication layer.
-- Keep the database invariant identical so concurrent binds cannot split one
-- mailbox across multiple site accounts.
CREATE UNIQUE INDEX "Account_bindEmail_lower_key" ON "Account" (LOWER("bindEmail"));

CREATE INDEX "Identity_playerUid_idx" ON "Identity" ("playerUid");
