import { NextRequest, NextResponse } from "next/server";
import { processImportFile } from "@/lib/services/importPipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const maybeFile = formData.get("file");
    const file = maybeFile instanceof File ? maybeFile : null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No file received." }, { status: 400 });
    }

    const result = await processImportFile(file);
    return NextResponse.json({
      success: result.report.failed === 0,
      report: result.report,
      data: result.contacts,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ success: false, error: "Failed to import file." }, { status: 500 });
  }
}
