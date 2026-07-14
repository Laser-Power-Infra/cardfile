import { RawContactRow } from "@/types/contact";

function normalizeCellValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined)
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value).trim() || null;
}

export function parseJsonFile(text: string): RawContactRow[] {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed) ? parsed : [parsed];

  return rows.map((item, index) => {
    const record: RawContactRow = { sourceRow: index + 1 } as RawContactRow;

    if (typeof item === "object" && item !== null) {
      Object.entries(item).forEach(([key, value]) => {
        record[key] = normalizeCellValue(value);
      });
    }

    return record;
  });
}
