import { RawContactRow } from "@/types/contact";

function unfoldVCardLines(text: string): string {
  return text.replace(/\r?\n[ \t]/g, "");
}

function parseKeyValue(line: string): { key: string; value: string } | null {
  const match = line.match(/^([^:;]+)(?:;[^:]*)?:(.*)$/);
  if (!match) {
    return null;
  }
  return { key: match[1].toUpperCase(), value: match[2].trim() };
}

export function parseVCF(text: string): RawContactRow[] {
  const unfolded = unfoldVCardLines(text);
  const cards = unfolded
    .split(/BEGIN:VCARD/i)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !/^END:VCARD/i.test(block));

  return cards.map((card, index) => {
    const row: RawContactRow = { sourceRow: index + 1, rawVCard: card } as RawContactRow;
    const lines = card.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      if (/^END:VCARD$/i.test(line)) {
        continue;
      }

      const parsed = parseKeyValue(line);
      if (!parsed) {
        continue;
      }

      const { key, value } = parsed;
      if (!row[key]) {
        row[key] = value;
      } else {
        row[key] = `${row[key]}, ${value}`;
      }
    }

    return row;
  });
}
