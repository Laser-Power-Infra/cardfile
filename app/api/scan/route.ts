import { NextRequest, NextResponse } from "next/server";
import { extractCardFromImage } from "@/lib/extractCard";
import { processImportFile } from "@/lib/services/importPipeline";
import type { ScanResponse } from "@/types/card";
import { prisma } from "@/lib/prisma";
import { partitionPhoneNumbers } from "@/lib/validators/phoneValidator";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function GET() {
  return NextResponse.json({
    status: "ok",
    apiKeyPresent: !!process.env.OPENAI_API_KEY,
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    // support both image uploads (key: image) and file imports (key: file)
    const maybeImage = formData.get("image");
    const maybeFile = formData.get("file");
    const file = (maybeImage || maybeFile) as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No file was received.",
        },
        { status: 400 }
      );
    }

    // Image path
    if (file.type && file.type.startsWith("image/") && ALLOWED_IMAGE_TYPES.includes(file.type)) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: "Image is too large. Please upload a file under 8MB.",
          },
          { status: 413 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      const data = await extractCardFromImage(base64, file.type);

      // Phone validation (structural, via libphonenumber-js — see
      // lib/validators/phoneValidator.ts). Invalid numbers are kept, not
      // dropped, so a person can see and fix an OCR misread rather than
      // silently losing the number.
      const mobilePartition = partitionPhoneNumbers(data.mobileNumbers ?? []);
      const telephonePartition = partitionPhoneNumbers(data.telephoneNumbers ?? []);
      data.mobileNumbers = mobilePartition.valid;
      data.telephoneNumbers = telephonePartition.valid;
      const invalidMobileNumbers = mobilePartition.invalid;
      const invalidTelephoneNumbers = telephonePartition.invalid;

      // Avoid duplicates: check existing contacts by emails / phones / name+company
      const emailCandidates = (data.emails ?? []).map((e) => String(e).toLowerCase());
      const mobileCandidates = (data.mobileNumbers ?? []).map((m) => String(m).replace(/[^+0-9]/g, ""));
      const telCandidates = (data.telephoneNumbers ?? []).map((t) => String(t).replace(/[^+0-9]/g, ""));

      const orClauses: any[] = [];
      for (const e of emailCandidates) orClauses.push({ emails: { has: e } });
      for (const m of mobileCandidates) orClauses.push({ mobileNumbers: { has: m } });
      for (const t of telCandidates) orClauses.push({ telephoneNumbers: { has: t } });
      if (data.fullName && data.company) orClauses.push({ AND: [{ fullName: data.fullName }, { company: data.company }] });

      const existing = await prisma.contact.findFirst({ where: { OR: orClauses.length ? orClauses : undefined as any } });

      if (!existing) {
        // No match — create new record
        const created = await prisma.contact.create({
          data: {
            fullName: data.fullName,
            jobTitle: data.jobTitle,
            company: data.company,

            mobileNumbers: data.mobileNumbers ?? [],
            telephoneNumbers: data.telephoneNumbers ?? [],
            invalidMobileNumbers,
            invalidTelephoneNumbers,

            emails: (data.emails ?? []).map((e) => String(e).toLowerCase()),

            website: data.website,
            address: data.address,
            companyLocation: data.companyLocation,

            linkedin: data.linkedin,

            rawNotes: null,
          },
        });

        return NextResponse.json({ success: true, data: created });
      }

      // If found, determine whether there is any new information to merge
      const existingEmails = new Set((existing.emails ?? []).map((e) => String(e).toLowerCase()));
      const existingMobiles = new Set((existing.mobileNumbers ?? []).map((m) => String(m).replace(/[^+0-9]/g, "")));
      const existingTels = new Set((existing.telephoneNumbers ?? []).map((t) => String(t).replace(/[^+0-9]/g, "")));

      const newEmails = (data.emails ?? []).filter((e) => !existingEmails.has(String(e).toLowerCase()));
      const newMobiles = (data.mobileNumbers ?? []).filter((m) => !existingMobiles.has(String(m).replace(/[^+0-9]/g, "")));
      const newTels = (data.telephoneNumbers ?? []).filter((t) => !existingTels.has(String(t).replace(/[^+0-9]/g, "")));

      const fieldsToUpdate: any = {};

      if (newEmails.length > 0) fieldsToUpdate.emails = Array.from(new Set([...(existing.emails ?? []).map(String), ...newEmails.map(String).map((s) => s.toLowerCase())]));
      if (newMobiles.length > 0) fieldsToUpdate.mobileNumbers = Array.from(new Set([...(existing.mobileNumbers ?? []).map(String), ...newMobiles.map(String)]));
      if (newTels.length > 0) fieldsToUpdate.telephoneNumbers = Array.from(new Set([...(existing.telephoneNumbers ?? []).map(String), ...newTels.map(String)]));

      const existingInvalidMobiles = new Set(((existing as any).invalidMobileNumbers ?? []).map(String));
      const existingInvalidTels = new Set(((existing as any).invalidTelephoneNumbers ?? []).map(String));
      const newInvalidMobiles = invalidMobileNumbers.filter((m) => !existingInvalidMobiles.has(m));
      const newInvalidTels = invalidTelephoneNumbers.filter((t) => !existingInvalidTels.has(t));

      if (newInvalidMobiles.length > 0) {
        fieldsToUpdate.invalidMobileNumbers = Array.from(new Set([...existingInvalidMobiles, ...newInvalidMobiles]));
      }
      if (newInvalidTels.length > 0) {
        fieldsToUpdate.invalidTelephoneNumbers = Array.from(new Set([...existingInvalidTels, ...newInvalidTels]));
      }

      // For scalar fields, update if incoming has data and existing doesn't
      if (data.jobTitle && !existing.jobTitle) fieldsToUpdate.jobTitle = data.jobTitle;
      if (data.company && !existing.company) fieldsToUpdate.company = data.company;
      if (data.website && !existing.website) fieldsToUpdate.website = data.website;
      if (data.address && !existing.address) fieldsToUpdate.address = data.address;
      if (data.companyLocation && !existing.companyLocation) fieldsToUpdate.companyLocation = data.companyLocation;
      if (data.linkedin && !existing.linkedin) fieldsToUpdate.linkedin = data.linkedin;

      // Merge rawNotes by appending new JSON if different


      if (Object.keys(fieldsToUpdate).length === 0) {
        // Nothing new — skip saving
        return NextResponse.json({ success: true, data: existing, message: "duplicate_skipped" });
      }

      const updated = await prisma.contact.update({ where: { id: existing.id }, data: fieldsToUpdate });
      return NextResponse.json({ success: true, data: updated, message: "merged" });
    }

    const name = file.name.toLowerCase();
    const isSpreadsheet =
      name.endsWith(".csv") ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls") ||
      name.endsWith(".vcf") ||
      name.endsWith(".bsf") ||
      name.endsWith(".json") ||
      file.type === "text/csv" ||
      file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "application/json" ||
      file.type === "text/vcard" ||
      file.type === "application/vcard";

    if (isSpreadsheet) {
      const result = await processImportFile(file);
      return NextResponse.json({
        success: result.report.failed === 0,
        report: result.report,
        data: result.contacts,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unsupported file type. Upload an image, spreadsheet, VCF, BSF, or JSON file.",
      },
      { status: 415 }
    );
  } catch (err) {
    console.error("Scan error:", err);

    const message =
      err instanceof Error
        ? err.message
        : "Something went wrong while scanning the card.";

    return NextResponse.json<ScanResponse>(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}