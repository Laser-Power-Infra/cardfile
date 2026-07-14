import { prisma } from "@/lib/prisma";

/**
 * Generic Postgres-backed cache (7-day TTL) shared by both the "View
 * Profile" lookup (lib/profile/buildPublicProfile.ts) and the company-brief
 * lookup (lib/profile/buildCompanyBrief.ts). Same table, different cache-key
 * namespace ("profile:..." vs "company:...") so re-opening either doesn't
 * re-run search + OpenAI calls (and cost) every time.
 *
 * Implemented with $queryRaw/$executeRaw against a small dedicated table
 * rather than a Prisma model, so this ships without requiring a
 * `prisma generate` cycle right away. See
 * prisma/migrations/*_add_profile_cache/migration.sql for the canonical DDL —
 * this function also applies it defensively on first use.
 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let ensuredTable = false;

async function ensureTable() {
  if (ensuredTable) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProfileCache" (
      "cacheKey" TEXT PRIMARY KEY,
      "contactId" TEXT,
      "payload" JSONB NOT NULL,
      "fetchedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  ensuredTable = true;
}

export function buildProfileCacheKey(input: {
  fullName: string | null;
  company: string | null;
  linkedin: string | null;
}) {
  return (
    "profile:" +
    [input.linkedin, input.fullName, input.company].map((v) => (v ?? "").trim().toLowerCase()).join("|")
  );
}

export function buildCompanyBriefCacheKey(company: string) {
  return "company:" + company.trim().toLowerCase();
}

export async function getCachedValue<T>(cacheKey: string): Promise<T | null> {
  await ensureTable();

  const rows = await prisma.$queryRawUnsafe<{ payload: T; fetchedAt: Date }[]>(
    `SELECT "payload", "fetchedAt" FROM "ProfileCache" WHERE "cacheKey" = $1 LIMIT 1;`,
    cacheKey
  );

  const row = rows[0];
  if (!row) return null;

  const ageMs = Date.now() - new Date(row.fetchedAt).getTime();
  if (ageMs > CACHE_TTL_MS) return null;

  return row.payload;
}

export async function setCachedValue<T>(
  cacheKey: string,
  contactId: string | null,
  value: T
): Promise<void> {
  await ensureTable();

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO "ProfileCache" ("cacheKey", "contactId", "payload", "fetchedAt")
    VALUES ($1, $2, $3::jsonb, now())
    ON CONFLICT ("cacheKey")
    DO UPDATE SET "contactId" = EXCLUDED."contactId", "payload" = EXCLUDED."payload", "fetchedAt" = now();
    `,
    cacheKey,
    contactId,
    JSON.stringify(value)
  );
}

// Backwards-compatible named wrappers used by buildPublicProfile.ts
export async function getCachedProfile<T>(cacheKey: string): Promise<T | null> {
  return getCachedValue<T>(cacheKey);
}
export async function setCachedProfile<T>(cacheKey: string, contactId: string | null, value: T): Promise<void> {
  return setCachedValue<T>(cacheKey, contactId, value);
}
