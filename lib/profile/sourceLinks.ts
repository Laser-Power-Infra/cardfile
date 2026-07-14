import type { CitedSource } from "./openaiWebSearch";
import type { PublicLink, PublicProfile } from "@/types/profile";

/**
 * Categorizes real cited URLs (from OpenAI's web search tool — see
 * lib/profile/openaiWebSearch.ts) into the Connect section buckets.
 * Every link here comes directly from a URL the model actually cited — it
 * never gets a chance to invent one, because it never writes these.
 *
 * A second (or third) hit for a domain that's already filled (e.g. a
 * company LinkedIn page in addition to the person's own LinkedIn profile)
 * falls through to `other` instead of being dropped, so nothing found is lost.
 */
export function categorizeSourceLinks(
  results: CitedSource[],
  companyDomain: string | null
): PublicProfile["links"] {
  const links: PublicProfile["links"] = {
    linkedin: null,
    companyWebsite: null,
    personalWebsite: null,
    twitter: null,
    github: null,
    crunchbase: null,
    angellist: null,
    arounddeal: null,
    tracxn: null,
    other: [],
  };

  const seenOther = new Set<string>();

  for (const result of results) {
    let host = "";
    try {
      host = new URL(result.url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }

    if (/linkedin\.com/.test(host)) {
      // Only ever surface one LinkedIn pill. Extra linkedin.com hits (a
      // secondary personal-profile match, a company page, a stale cached
      // redirect URL, etc.) are dropped entirely rather than cluttering the
      // Connect row with near-duplicate "linkedin.com" pills.
      if (!links.linkedin) {
        links.linkedin = result.url;
      }
      continue;
    }

    if (!links.crunchbase && /crunchbase\.com/.test(host)) {
      links.crunchbase = result.url;
    } else if (!links.angellist && /(angel\.co|wellfound\.com)/.test(host)) {
      links.angellist = result.url;
    } else if (!links.arounddeal && /arounddeal\.com/.test(host)) {
      links.arounddeal = result.url;
    } else if (!links.tracxn && /tracxn\.com/.test(host)) {
      links.tracxn = result.url;
    } else if (!links.github && /github\.com/.test(host)) {
      links.github = result.url;
    } else if (!links.twitter && /(twitter\.com|x\.com)/.test(host)) {
      links.twitter = result.url;
    } else if (companyDomain && host.endsWith(companyDomain) && !links.companyWebsite) {
      links.companyWebsite = result.url;
    } else if (
      !links.personalWebsite &&
      /(medium\.com|substack\.com|about\.me)/.test(host)
    ) {
      links.personalWebsite = result.url;
    } else if (!seenOther.has(result.url) && links.other.length < 5) {
      seenOther.add(result.url);
      links.other.push({ label: result.title || host, url: result.url } satisfies PublicLink);
    }
  }

  return links;
}

export function extractDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const withScheme = website.startsWith("http") ? website : `https://${website}`;
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
