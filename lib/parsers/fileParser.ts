import { RawContactRow } from "@/types/contact";
import { parseJsonFile } from "./jsonParser";
import { parseSpreadsheetFile } from "./spreadsheetParser";
import { parseVCF } from "./vcfParser";

function normalizeFileName(fileName: string): string {
  return fileName.toLowerCase().trim();
}

export async function parseImportedFile(file: File): Promise<RawContactRow[]> {
  const fileName = normalizeFileName(file.name);

  if (
    fileName.endsWith(".csv") ||
    fileName.endsWith(".xlsx") ||
    fileName.endsWith(".xls") ||
    file.type.includes("spreadsheet") ||
    file.type === "text/csv"
  ) {
    return parseSpreadsheetFile(await file.arrayBuffer());
  }

  if (
    fileName.endsWith(".vcf") ||
    file.type === "text/vcard" ||
    file.type === "application/vcard"
  ) {
    return parseVCF(await file.text());
  }

  if (
    fileName.endsWith(".bsf") ||
    fileName.endsWith(".json") ||
    file.type === "application/json"
  ) {
    return parseJsonFile(await file.text());
  }

  throw new Error("Unsupported import file type. Use CSV, Excel, VCF, BSF, or JSON.");
}
