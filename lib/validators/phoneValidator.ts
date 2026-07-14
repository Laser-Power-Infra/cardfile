import { parsePhoneNumberFromString, CountryCode } from "libphonenumber-js";

/**
 * Default country used to interpret a number that has no "+countrycode"
 * prefix (e.g. a CSV column with a bare "9876543210"). Override with the
 * DEFAULT_PHONE_COUNTRY env var if most of your contacts are from a
 * different country. Numbers that already include a country code
 * (e.g. "+91 98765 43210") are parsed correctly regardless of this default.
 */
const DEFAULT_COUNTRY = (process.env.DEFAULT_PHONE_COUNTRY as CountryCode) || "IN";

export type PhoneNumberType =
  | "mobile"
  | "fixed_line"
  | "fixed_line_or_mobile"
  | "voip"
  | "toll_free"
  | "premium_rate"
  | "unknown";

export interface PhoneValidationResult {
  input: string;
  isValid: boolean;
  /** E.164/international formatted number, only present when isValid is true. */
  formatted: string | null;
  country: string | null;
  numberType: PhoneNumberType;
}

/**
 * Structural validation only: is this a real, dialable phone number for its
 * country (correct length, valid prefix, etc)? This does NOT confirm the
 * number is currently active/reachable — that requires a paid carrier
 * lookup (Twilio Lookup, Numverify, etc), which is a separate, optional
 * upgrade documented in phoneValidator's module comment below.
 */
export function validatePhoneNumber(
  raw: string,
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): PhoneValidationResult {
  const input = raw.trim();

  if (!input) {
    return { input, isValid: false, formatted: null, country: null, numberType: "unknown" };
  }

  try {
    const parsed = parsePhoneNumberFromString(input, defaultCountry);

    if (!parsed || !parsed.isValid()) {
      return { input, isValid: false, formatted: null, country: null, numberType: "unknown" };
    }

    return {
      input,
      isValid: true,
      formatted: parsed.formatInternational(),
      country: parsed.country ?? null,
      numberType: (parsed.getType() as PhoneNumberType) ?? "unknown",
    };
  } catch {
    // libphonenumber-js throws on some malformed input (e.g. way too long) rather than returning null.
    return { input, isValid: false, formatted: null, country: null, numberType: "unknown" };
  }
}

export function isValidPhoneNumber(raw: string, defaultCountry: CountryCode = DEFAULT_COUNTRY): boolean {
  return validatePhoneNumber(raw, defaultCountry).isValid;
}

export interface PartitionedPhoneNumbers {
  /** Formatted, deduplicated, structurally valid numbers. */
  valid: string[];
  /** Original (as-entered) numbers that failed validation — kept for manual review. */
  invalid: string[];
}

/**
 * Splits a list of raw phone number strings into valid (reformatted to a
 * consistent international format) and invalid (left as-is, so the original
 * OCR/CSV text is still visible for a person to correct).
 */
export function partitionPhoneNumbers(
  numbers: string[],
  defaultCountry: CountryCode = DEFAULT_COUNTRY
): PartitionedPhoneNumbers {
  const valid: string[] = [];
  const invalid: string[] = [];
  const seenValid = new Set<string>();
  const seenInvalid = new Set<string>();

  for (const raw of numbers) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const result = validatePhoneNumber(trimmed, defaultCountry);

    if (result.isValid && result.formatted) {
      if (!seenValid.has(result.formatted)) {
        seenValid.add(result.formatted);
        valid.push(result.formatted);
      }
    } else {
      const key = trimmed.toLowerCase();
      if (!seenInvalid.has(key)) {
        seenInvalid.add(key);
        invalid.push(trimmed);
      }
    }
  }

  return { valid, invalid };
}
