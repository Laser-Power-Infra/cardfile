import * as XLSX from "xlsx";
import { RawContactRow } from "@/types/contact";

function normalizeHeader(value: unknown, index: number): string {
  if (value === null || value === undefined) {
    return `column_${index + 1}`;
  }

  const normalized = String(value).trim();
  return normalized === ""
    ? `column_${index + 1}`
    : normalized;
}

export function parseSpreadsheetFile(
  data: ArrayBuffer
): RawContactRow[] {
  const workbook = XLSX.read(Buffer.from(data), {
    type: "buffer",
    raw: false,
  });

  const rows: RawContactRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];

    const sheetRows: any[] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
    });

    if (sheetRows.length === 0) continue;

    const headers = (sheetRows.shift() as any[]).map(normalizeHeader);

    for (let rowIndex = 0; rowIndex < sheetRows.length; rowIndex++) {
      const row = sheetRows[rowIndex] as any[];

      const record: RawContactRow = {
        sourceRow: rowIndex + 2,
      } as RawContactRow;

      headers.forEach((header, columnIndex) => {
        const value = row[columnIndex];

        record[header] =
          value === null || value === undefined
            ? null
            : String(value).trim();
      });

      /*
      ------------------------------------------
      Build Full Name
      ------------------------------------------
      */

      const givenName =
        (record["Given Name"] as string) ||
        (record["First Name"] as string) ||
        "";

      const familyName =
        (record["Family Name"] as string) ||
        (record["Last Name"] as string) ||
        "";

      const fullName =
        givenName && familyName
          ? `${givenName} ${familyName}`
          : (record["Name"] as string) || "";

      record.fullName = fullName;

      /*
      ------------------------------------------
      Company
      ------------------------------------------
      */

      record.company =
        (record["Company"] as string) ||
        (record["Organization"] as string) ||
        "";

      /*
      ------------------------------------------
      Job Title
      ------------------------------------------
      */

      record.jobTitle =
        (record["Job Title"] as string) ||
        (record["Title"] as string) ||
        "";

      /*
      ------------------------------------------
      Never use Sheet1 as name
      ------------------------------------------
      */

      if (
        record.fullName === "Sheet1" ||
        record.fullName === sheetName
      ) {
        record.fullName = "";
      }

      rows.push(record);
    }
  }

  return rows;
}