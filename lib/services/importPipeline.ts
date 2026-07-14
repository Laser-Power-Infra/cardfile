import { parseImportedFile } from "@/lib/parsers/fileParser";
import { extractContacts } from "@/lib/extractors/contactExtractor";
import { saveNormalizedContacts } from "@/lib/services/contactSaveService";
import type { ImportResult } from "@/types/contact";

export async function processImportFile(file: File): Promise<ImportResult> {
  const rows = await parseImportedFile(file);
  const normalizedContacts = extractContacts(rows);
  return saveNormalizedContacts(normalizedContacts);
}
