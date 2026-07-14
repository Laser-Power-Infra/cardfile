import OpenAI from "openai";

/**
 * Grounds the "View Profile" feature using OpenAI's own built-in web search
 * (the Responses API's `web_search_preview` tool) instead of a separate
 * SerpApi/Bing key. Same OPENAI_API_KEY you already use for OCR — no new
 * account, no new .env variable.
 *
 * Trade-off vs. a dedicated search API: OpenAI's web search doesn't surface
 * thumbnail/profile images the way some search providers occasionally do,
 * so `avatarUrl` will effectively always be null here — the UI's initials
 * avatar is the expected fallback, not a bug.
 */

let openaiClient: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

export interface CitedSource {
  title: string;
  url: string;
}

export interface WebResearchResult {
  /** Freeform narrative the model wrote while researching, grounded in real search results. */
  researchText: string;
  /** Every URL the model actually cited while researching — never invented. */
  sources: CitedSource[];
}

/**
 * Runs a real web search (via OpenAI's Responses API) and returns both the
 * research narrative and the list of URLs the model actually cited. Returns
 * null if no OPENAI_API_KEY is configured or the search call fails — the
 * caller treats that as "couldn't verify," never falling back to a guess.
 */
export async function researchPublicProfile(query: string): Promise<WebResearchResult | null> {
  const openai = getOpenAiClient();
  if (!openai) return null;

  try {
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      tools: [{ type: "web_search_preview" }],
      input: query,
    });

    const researchText = response.output_text ?? "";

    const sources: CitedSource[] = [];
    const seen = new Set<string>();

    for (const item of response.output ?? []) {
      if (item.type !== "message") continue;
      for (const block of (item as any).content ?? []) {
        if (block.type !== "output_text") continue;
        for (const annotation of block.annotations ?? []) {
          if (annotation.type !== "url_citation" || !annotation.url) continue;
          if (seen.has(annotation.url)) continue;
          seen.add(annotation.url);
          sources.push({ title: annotation.title || annotation.url, url: annotation.url });
        }
      }
    }

    if (!researchText.trim() && sources.length === 0) return null;

    return { researchText, sources };
  } catch (error) {
    console.error("OpenAI web search failed:", error);
    return null;
  }
}

export function isSearchProviderConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
