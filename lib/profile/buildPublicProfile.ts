import OpenAI from "openai";
import type { PublicProfile, SourceRef } from "@/types/profile";
import { isSearchProviderConfigured, researchPublicProfile } from "./openaiWebSearch";
import { categorizeSourceLinks, extractDomain } from "./sourceLinks";

let openaiClient: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

export interface ProfileLookupInput {
  fullName: string | null;
  company: string | null;
  jobTitle: string | null;
  linkedin: string | null;
  website: string | null;
  email: string | null;
}

const RESEARCH_INSTRUCTIONS_SUFFIX = `

Search the public web for this person's LinkedIn profile, career history,
education, and current role, plus information about their company (industry,
founding year, headquarters, leadership team, overview, products/services).

Report only what you actually find. If something can't be confirmed, say so
explicitly (e.g. "exact start date not publicly available") rather than
guessing or omitting it silently.

If you find a direct image URL (ending in .jpg, .jpeg, .png, or .webp) that
you're confident is a photo of this specific person, state it on its own
line as "Photo URL: <url>". Only include it if genuinely confident — never
guess or invent one.`;

const GROUNDED_STRUCTURING_PROMPT = `
You will be given research notes that were already gathered from a real web
search about a business contact and their company. Convert those notes into
the exact JSON schema below.

STRICT RULES:
- Use ONLY facts present in the research notes provided. Never add facts you
  weren't given, even if you recognize the company or person from your own
  training.
- If the notes flag something as uncertain (e.g. "dates not publicly
  available"), keep that caveat in the text — don't smooth it into a
  confident-sounding claim.
- If a field has no support in the notes, return null (for strings) or an
  empty array (for lists) rather than filling the gap.
- Return valid JSON only, matching the exact schema given, no extra prose.

Return exactly this JSON shape:
{
  "location": null,
  "career": {
    "currentRole": null,
    "trajectory": [],
    "education": [],
    "certifications": [],
    "awards": [],
    "skills": [],
    "languages": [],
    "notableAchievements": []
  },
  "companyInfo": {
    "name": null,
    "industry": null,
    "overview": null,
    "founded": null,
    "headquarters": null,
    "coreBusiness": null,
    "productsAndServices": [],
    "companySize": null,
    "funding": null,
    "revenue": null,
    "keyLeadership": [],
    "marketPosition": null
  },
  "aiSummary": null
}

"career.trajectory" should be an array of one-line strings describing each
role held, most recent first, e.g. "Partner, Investment Banking and Markets
Leader - Strategy and Transactions at EY (prior role; dates not publicly
available)".

"companyInfo.keyLeadership" entries should read like "Sachin Bhartiya
(Founder & Managing Partner)".

"aiSummary" should be a concise, factual professional summary between 150 and
250 words, third person, based only on the research notes.
`;

function buildResearchQuery(input: ProfileLookupInput): string {
  const person = input.fullName?.trim() ?? "";
  const company = input.company?.trim();
  const jobTitle = input.jobTitle?.trim();

  let query = `Research the public professional profile of ${person}`;
  if (jobTitle) query += `, ${jobTitle}`;
  if (company) query += ` at ${company}`;
  if (input.linkedin) query += `. Their LinkedIn profile: ${input.linkedin}`;

  return query + RESEARCH_INSTRUCTIONS_SUFFIX;
}

function buildLinkedInQuery(input: ProfileLookupInput): string {
  const person = input.fullName?.trim() ?? "";
  const company = input.company?.trim();
  const jobTitle = input.jobTitle?.trim();

  return (
    `site:linkedin.com/in ${person}${jobTitle ? ` ${jobTitle}` : ""}${company ? ` ${company}` : ""}\n\n` +
    `Find this specific person's LinkedIn profile URL. State the exact URL clearly in your answer ` +
    `if you find a confident match (matching name and, ideally, company/role). ` +
    `If you cannot find a specific match, say so explicitly rather than guessing or citing an unrelated profile.\n\n` +
    `Separately: if any of the pages you look at (LinkedIn included, or a company "team" page, ` +
    `press article, conference bio, etc.) surfaces a direct image URL for this person's photo ` +
    `(a URL ending in .jpg, .jpeg, .png, or .webp), state that URL explicitly on its own line as ` +
    `"Photo URL: <url>". Only include it if you are confident it's a photo of this specific person — ` +
    `never guess or invent one, and don't include LinkedIn's generic placeholder/default avatar images.`
  );
}

function extractPhotoUrl(text: string | undefined): string | null {
  if (!text) return null;

  // Look specifically for the "Photo URL: <url>" line we asked the model to
  // report, rather than pattern-matching any image-looking URL anywhere in
  // the text — this keeps it tied to something the model explicitly flagged
  // as a confident match for this person, not an incidental image mention.
  const match = text.match(/photo url:\s*(https?:\/\/\S+\.(?:jpg|jpeg|png|webp))/i);
  return match ? match[1].replace(/[.,)]+$/, "") : null;
}

function safeJsonParse<T>(text: string): T | null {
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fenced ? fenced[1] : text;
    return JSON.parse(jsonText.trim()) as T;
  } catch {
    return null;
  }
}

/**
 * Looks up public information for a contact using OpenAI's own web search
 * (Responses API `web_search_preview` tool) — no separate search API key
 * required, just the OPENAI_API_KEY the rest of this app already uses.
 *
 * Two-step process:
 *   1. `researchPublicProfile` performs a REAL web search and returns a
 *      grounded research narrative plus every URL actually cited.
 *   2. A plain (non-tool) chat completion converts that narrative into our
 *      strict JSON schema, instructed to use only what's in the notes.
 *
 * Returns null when nothing verifiable could be found — the caller turns
 * that into "No public professional profile could be found." Never
 * fabricates data to fill the gap.
 */
export async function buildPublicProfile(input: ProfileLookupInput): Promise<PublicProfile | null> {
  if (!input.fullName) return null;

  if (!isSearchProviderConfigured()) {
    // No OPENAI_API_KEY: refuse to guess. This is what prevents
    // hallucinated career histories, fake AUM figures, etc.
    return null;
  }

  const [research, linkedinResearch] = await Promise.all([
    researchPublicProfile(buildResearchQuery(input)),
    // Dedicated call: general search rarely surfaces LinkedIn (it blocks most
    // crawlers), so a plain "research this person" query often misses it.
    // A separate, forceful site:linkedin.com query finds it far more often.
    input.linkedin ? Promise.resolve(null) : researchPublicProfile(buildLinkedInQuery(input)),
  ]);

  if (!research || (!research.researchText.trim() && research.sources.length === 0)) {
    return null;
  }

  // linkedinResearch's citations go FIRST: that search was specifically
  // targeted at finding this person's LinkedIn profile, so its result
  // should win the "one LinkedIn pill" slot over anything the general
  // research call happened to cite incidentally.
  const allSources = [...(linkedinResearch?.sources ?? []), ...research.sources];
  // De-dupe by URL (the two searches can surface the same page).
  const seenUrls = new Set<string>();
  const dedupedSources = allSources.filter((s) => {
    if (seenUrls.has(s.url)) return false;
    seenUrls.add(s.url);
    return true;
  });

  const companyDomain = extractDomain(input.website);
  const links = categorizeSourceLinks(dedupedSources, companyDomain);

  // Trust a LinkedIn URL you already know (from CSV import or a manual edit)
  // over anything search found — known data beats a guess.
  if (input.linkedin) {
    links.linkedin = input.linkedin;
  }

  let combinedResearchText = research.researchText;
  if (linkedinResearch?.researchText?.trim()) {
    combinedResearchText += `\n\nLinkedIn search notes:\n${linkedinResearch.researchText}`;
  }

  const openai = getOpenAiClient();

  let grounded: any = null;
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 1600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: GROUNDED_STRUCTURING_PROMPT },
          {
            role: "user",
            content: `Person: ${input.fullName}\nCompany: ${input.company ?? "unknown"}\nJob title: ${
              input.jobTitle ?? "unknown"
            }\n\nResearch notes (already gathered from a real web search):\n${combinedResearchText}`,
          },
        ],
      });

      const text = response.choices[0]?.message?.content ?? "";
      grounded = safeJsonParse(text);
    } catch (error) {
      console.error("Profile structuring failed:", error);
    }
  }

  const sourceRefs: SourceRef[] = dedupedSources.map((s) => ({
    label: s.title || s.url,
    url: s.url,
  }));

  const profile: PublicProfile = {
    fullName: input.fullName,
    jobTitle: input.jobTitle,
    company: input.company,
    location: grounded?.location ?? null,
    // Best-effort only: a real, publicly-indexed image URL the search
    // explicitly surfaced (never LinkedIn itself — their photos aren't
    // reachable via search — but occasionally a company "team" page, press
    // photo, or conference bio reuses the same headshot). Stays null, and
    // the UI falls back to an initials avatar, far more often than not.
    avatarUrl: extractPhotoUrl(linkedinResearch?.researchText) ?? extractPhotoUrl(research.researchText),
    links,
    career: {
      currentRole: grounded?.career?.currentRole ?? input.jobTitle ?? null,
      trajectory: Array.isArray(grounded?.career?.trajectory) ? grounded.career.trajectory : [],
      education: Array.isArray(grounded?.career?.education) ? grounded.career.education : [],
      certifications: Array.isArray(grounded?.career?.certifications)
        ? grounded.career.certifications
        : [],
      awards: Array.isArray(grounded?.career?.awards) ? grounded.career.awards : [],
      skills: Array.isArray(grounded?.career?.skills) ? grounded.career.skills : [],
      languages: Array.isArray(grounded?.career?.languages) ? grounded.career.languages : [],
      notableAchievements: Array.isArray(grounded?.career?.notableAchievements)
        ? grounded.career.notableAchievements
        : [],
    },
    companyInfo: {
      name: grounded?.companyInfo?.name ?? input.company ?? null,
      logoUrl: null,
      industry: grounded?.companyInfo?.industry ?? null,
      overview: grounded?.companyInfo?.overview ?? null,
      founded: grounded?.companyInfo?.founded ?? null,
      headquarters: grounded?.companyInfo?.headquarters ?? null,
      coreBusiness: grounded?.companyInfo?.coreBusiness ?? null,
      productsAndServices: Array.isArray(grounded?.companyInfo?.productsAndServices)
        ? grounded.companyInfo.productsAndServices
        : [],
      companySize: grounded?.companyInfo?.companySize ?? null,
      funding: grounded?.companyInfo?.funding ?? null,
      revenue: grounded?.companyInfo?.revenue ?? null,
      keyLeadership: Array.isArray(grounded?.companyInfo?.keyLeadership)
        ? grounded.companyInfo.keyLeadership
        : [],
      marketPosition: grounded?.companyInfo?.marketPosition ?? null,
      website: links.companyWebsite ?? input.website,
    },
    aiSummary: typeof grounded?.aiSummary === "string" ? grounded.aiSummary : null,
    sources: sourceRefs,
    fetchedAt: new Date().toISOString(),
  };

  return profile;
}
