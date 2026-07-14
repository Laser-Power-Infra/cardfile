import { researchPublicProfile, isSearchProviderConfigured } from "./openaiWebSearch";
import { getCachedValue, setCachedValue, buildCompanyBriefCacheKey } from "./profileCache";

export interface CompanyBrief {
  overview: string | null;
  fetchedAt: string;
}

const BRIEF_PROMPT_SUFFIX = `

Write a 1-2 sentence factual overview of this company (what it does,
industry, and headquarters if known) based only on real search results.
If you can't find anything reliable about this specific company, say so in
one short sentence rather than guessing or describing a similarly-named
company.`;

/**
 * One real web-search call (not the full two-call profile pipeline) to keep
 * the per-row cost of the table's "Company Brief" column reasonable. Cached
 * for 7 days and keyed by company name only, so multiple contacts at the
 * same company share a single lookup instead of paying for it once per row.
 */
export async function buildCompanyBrief(company: string): Promise<CompanyBrief | null> {
  const trimmed = company.trim();
  if (!trimmed) return null;

  if (!isSearchProviderConfigured()) return null;

  const cacheKey = buildCompanyBriefCacheKey(trimmed);
  const cached = await getCachedValue<CompanyBrief>(cacheKey);
  if (cached) return cached;

  const research = await researchPublicProfile(
    `What does the company "${trimmed}" do?` + BRIEF_PROMPT_SUFFIX
  );

  if (!research || !research.researchText.trim()) return null;

  const brief: CompanyBrief = {
    overview: research.researchText.trim(),
    fetchedAt: new Date().toISOString(),
  };

  await setCachedValue(cacheKey, null, brief);

  return brief;
}
