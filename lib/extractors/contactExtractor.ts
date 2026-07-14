import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";
import { RawContactRow, NormalizedContact } from "@/types/contact";

const DEFAULT_COUNTRY = (process.env.DEFAULT_PHONE_COUNTRY as CountryCode) || "IN";

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const websiteRegex = /^(https?:\/\/)?([\w.-]+\.[a-z]{2,})(\/.*)?$/i;
const linkedinRegex = /linkedin\.com\/[A-Za-z0-9_\-\/]+/i;

// Google Contacts (and some CRM exports) put a photo/avatar URL in its own
// "Photo" column, but the value itself is just a bare CDN URL with no
// obvious "photo" wording in it — so it can otherwise slip past the
// header-based photo check and get misclassified as a real "website" by the
// value-based `websiteRegex.test(value)` fallback below. Explicitly reject
// known image-hosting domains regardless of which column they came from.
const IMAGE_HOST_BLOCKLIST = /googleusercontent\.com|ggpht\.com|gstatic\.com|fbcdn\.net|twimg\.com/i;

function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!emailRegex.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[^(\d+)]+/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(raw, DEFAULT_COUNTRY);
  if (parsed && parsed.isValid()) {
    return parsed.formatInternational();
  }

  return cleaned;
}

function normalizeWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (linkedinRegex.test(trimmed)) {
    return null;
  }

  if (IMAGE_HOST_BLOCKLIST.test(trimmed)) {
    return null;
  }

  const normalized = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  if (websiteRegex.test(normalized)) {
    return normalized;
  }

  return null;
}

function extractValue(row: RawContactRow, keys: RegExp[]): string | null {
  for (const [rawKey, rawValue] of Object.entries(row)) {
    if (rawValue === null || rawValue === undefined) {
      continue;
    }

    const lowerKey = rawKey.toLowerCase();
    if (keys.some((matcher) => matcher.test(lowerKey))) {
      const value = String(rawValue).trim();
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function appendUnique(values: string[], candidate: string | null): string[] {
  if (!candidate) {
    return values;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return values;
  }

  const normalized = trimmed.toLowerCase();
  if (values.some((item) => item.toLowerCase() === normalized)) {
    return values;
  }

  return [...values, trimmed];
}

export function extractContacts(rows: RawContactRow[]): NormalizedContact[] {
  return rows.map((rawRow) => {
    const mobileNumbers: string[] = [];
    const telephoneNumbers: string[] = [];
    const emails: string[] = [];
    let website: string | null = null;
    let linkedin: string | null = null;
    let fullName: string | null = null;
    let jobTitle: string | null = null;
    let company: string | null = null;
    let address: string | null = null;
    let companyLocation: string | null = null;
    let photo: string | null = null;

    for (const [cellKey, cellValue] of Object.entries(rawRow)) {
      if (cellValue === null || cellValue === undefined) {
        continue;
      }

      const value = String(cellValue).trim();
      if (!value) {
        continue;
      }

      const lowerKey = cellKey.toLowerCase();
      const lowerValue = value.toLowerCase();

      if (/^fn$|name|full name|given name|first name|last name/.test(lowerKey)) {
        fullName = fullName || value;
      }

      if (/title|position|designation|role|job/.test(lowerKey)) {
        jobTitle = jobTitle || value;
      }

      if (/company|organisation|organization|employer|business|org|firm/.test(lowerKey)) {
        company = company || value;
      }

      if (/photo|logo|image/.test(lowerKey)) {
        photo = photo || value;
        // A photo/avatar URL is never a website, address, or anything else
        // useful to this contact — skip every other check for this cell
        // instead of letting it also get misclassified as a "website" by
        // the value-based URL heuristic further down.
        continue;
      }

      // "Address 1 - Type" (Home/Work) is a label, not address text — skip
      // it entirely so it doesn't get glued onto the front of the address.
      if (/address.*type$/i.test(lowerKey) || /^type$/i.test(lowerKey)) {
        continue;
      }

      // Google Contacts exports a single, already-clean "Address N -
      // Formatted" column alongside separate Street/City/State/Postal
      // sub-columns. If a formatted column exists, prefer it exclusively
      // rather than also concatenating the sub-components (which is what
      // was producing "Home, Kolkata, India, Kolkata, India").
      if (/address.*formatted/i.test(lowerKey)) {
        address = value;
        continue;
      }

      if (!address && /address|street|city|state|zip|postal/.test(lowerKey)) {
        address = address ? `${address}, ${value}` : value;
      }

      if (/location|city|country|province/.test(lowerKey)) {
        companyLocation = companyLocation || value;
      }

      if (/linkedin/.test(lowerKey) || linkedinRegex.test(value)) {
        linkedin = linkedin || value;
      }

      if (/website|url|site|homepage/.test(lowerKey) || websiteRegex.test(value)) {
        website = website || normalizeWebsite(value);
      }

      if (/email/.test(lowerKey) || emailRegex.test(value)) {
        const normalizedEmail = normalizeEmail(value);
        if (normalizedEmail) {
          emails.push(normalizedEmail);
        }
      }

      if (/tel|telephone|phone|mobile|cell|direct|office|fax/.test(lowerKey)) {
        const normalizedPhone = normalizePhone(value);
        if (normalizedPhone) {
          if (/mobile|cell|mobi/.test(lowerKey) || /mobile|cell|mobi/.test(lowerValue)) {
            mobileNumbers.push(normalizedPhone);
          } else {
            telephoneNumbers.push(normalizedPhone);
          }
        }
      }

      if (!fullName && /[A-Z][a-z]+\s+[A-Z][a-z]+/.test(value) && !/\d/.test(value)) {
        fullName = value;
      }
    }

    if (!fullName) {
      fullName = extractValue(rawRow, [/^fn$/, /^name$/i]);
    }
    if (!company) {
      company = extractValue(rawRow, [/^org$/i, /company/i]);
    }
    if (!jobTitle) {
      jobTitle = extractValue(rawRow, [/^title$/i, /position/i]);
    }
    if (!website) {
      const inferredWebsite = extractValue(rawRow, [/website|url|site|homepage/i]);
      website = inferredWebsite ? normalizeWebsite(inferredWebsite) : null;
    }
    if (!linkedin) {
      const inferredLinkedin = extractValue(rawRow, [/linkedin/i]);
      linkedin = inferredLinkedin || null;
    }

    const uniqueMobiles = Array.from(new Set(mobileNumbers.filter(Boolean)));
    const uniqueTelephones = Array.from(new Set(telephoneNumbers.filter(Boolean)));
    const uniqueEmails = Array.from(new Set(emails.filter(Boolean).map((email) => email.toLowerCase())));

    return {
      fullName: fullName || null,
      jobTitle: jobTitle || null,
      company: company || null,

      mobileNumbers: uniqueMobiles,
      telephoneNumbers: uniqueTelephones,
      invalidMobileNumbers: [],
      invalidTelephoneNumbers: [],
      emails: uniqueEmails,

      website: website || null,
      address: address || null,
      companyLocation: companyLocation || null,

      linkedin: linkedin || null,
      otherSocials: [],
      photo,

     // Remove raw JSON completely
     rawNotes: null,

     sourceRow: rawRow.sourceRow ?? undefined,
    };
  });
}
