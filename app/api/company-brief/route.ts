import { NextRequest, NextResponse } from "next/server";
import { buildCompanyBrief } from "@/lib/profile/buildCompanyBrief";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { company } = (await req.json()) as { company?: string };

    if (!company || !company.trim()) {
      return NextResponse.json(
        { success: false, data: null, error: "A company name is required." },
        { status: 400 }
      );
    }

    const brief = await buildCompanyBrief(company);

    if (!brief) {
      return NextResponse.json({
        success: true,
        data: null,
        message: "No public information found for this company.",
      });
    }

    return NextResponse.json({ success: true, data: brief });
  } catch (error) {
    console.error("Company brief lookup error:", error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : "Unable to look up company details.",
      },
      { status: 500 }
    );
  }
}
