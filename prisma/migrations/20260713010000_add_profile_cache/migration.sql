-- Cache table for the "View Profile" (AI Contact Intelligence Profile)
-- feature. 7-day TTL is enforced in application code — see
-- lib/profile/profileCache.ts. Also self-created defensively at runtime,
-- so this migration is optional but keeps schema history accurate.
CREATE TABLE IF NOT EXISTS "ProfileCache" (
  "cacheKey" TEXT PRIMARY KEY,
  "contactId" TEXT,
  "payload" JSONB NOT NULL,
  "fetchedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ProfileCache_contactId_idx" ON "ProfileCache" ("contactId");
