import { NextRequest, NextResponse } from "next/server";
import type { CardData } from "@/types/card";
import type { ProfileApiResponse, PublicProfile } from "@/types/profile";
import { buildPublicProfile } from "@/lib/profile/buildPublicProfile";
import { buildProfileCacheKey, getCachedProfile, setCachedProfile } from "@/lib/profile/profileCache";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * View Profile -> Search Public Sources -> Collect Public Data ->
 * Validate Sources -> Fetch Public Profile Image -> Generate AI Summary
 * (OpenAI) -> Return Structured JSON -> Render Profile UI
 *
 * Never fabricates data: if no public source is found for a contact, this
 * returns `{ success: true, data: null }` with a plain "not found" message
 * rather than asking the model to guess.
 */
export async function POST(req: NextRequest) {
  try {
    const contact = (await req.json()) as CardData & { forceRefresh?: boolean };

    if (!contact.fullName) {
      return NextResponse.json<ProfileApiResponse>(
        { success: false, data: null, error: "A contact name is required to look up a public profile." },
        { status: 400 }
      );
    }

    const cacheKey = buildProfileCacheKey({
      fullName: contact.fullName,
      company: contact.company,
      linkedin: contact.linkedin,
    });

    if (!contact.forceRefresh) {
      const cached = await getCachedProfile<PublicProfile>(cacheKey);
      if (cached) {
        return NextResponse.json<ProfileApiResponse>({ success: true, data: cached, cached: true });
      }
    }

    const profile = await buildPublicProfile({
      fullName: contact.fullName,
      company: contact.company,
      jobTitle: contact.jobTitle,
      linkedin: contact.linkedin,
      website: contact.website,
      email: contact.emails?.[0] ?? null,
    });

    if (!profile) {
      return NextResponse.json<ProfileApiResponse>({
        success: true,
        data: null,
        message: "No public professional profile could be found for this contact.",
      });
    }

    await setCachedProfile(cacheKey, contact.id ?? null, profile);

    return NextResponse.json<ProfileApiResponse>({ success: true, data: profile, cached: false });
  } catch (error) {
    console.error("Profile enrichment error:", error);

    return NextResponse.json<ProfileApiResponse>(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unable to enrich profile.",
      },
      { status: 500 }
    );
  }
}
