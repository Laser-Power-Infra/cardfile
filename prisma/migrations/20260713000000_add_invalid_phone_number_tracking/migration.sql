-- Tracks phone numbers that failed structural validation (see
-- lib/validators/phoneValidator.ts) so they can be shown as "unverified"
-- in the UI and manually corrected, instead of being silently dropped.
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "invalidMobileNumbers" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "invalidTelephoneNumbers" TEXT[] NOT NULL DEFAULT '{}';
