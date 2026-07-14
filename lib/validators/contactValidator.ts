import { NormalizedContact, ValidationResult } from "@/types/contact";
import { partitionPhoneNumbers } from "@/lib/validators/phoneValidator";

const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function isValidEmail(email: string): boolean {
  return emailRegex.test(email.trim());
}

export interface ValidateContactOptions {
  /**
   * When true (default), a contact must have at least one VALID email OR
   * phone number. This is correct when importing/creating a contact — we
   * don't want to save unreachable junk records.
   *
   * When editing an EXISTING contact, set this to false: some already-saved
   * records (bad CSV rows, low-quality OCR scans, etc.) never had a phone or
   * email to begin with, and a person should still be able to fix the name
   * or company on that record without being forced to invent contact info
   * for it in the same request.
   */
  requireContactMethod?: boolean;
}

export function validateNormalizedContact(
  contact: NormalizedContact,
  options: ValidateContactOptions = {}
): ValidationResult {
  const { requireContactMethod = true } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // ----------------------------------------
  // Remove empty values before validation
  // ----------------------------------------

  const emails = contact.emails
    .map((e) => e.trim())
    .filter(Boolean);

  // ----------------------------------------
  // Phone validation (structural, via libphonenumber-js)
  // ----------------------------------------
  // Numbers that fail validation are NOT dropped and do NOT block the save —
  // they're moved into invalid*Numbers so the UI can flag them as
  // "unverified" and a person can manually fix an OCR/CSV misread instead of
  // silently losing the number.

  const rawMobiles = contact.mobileNumbers.map((m) => m.trim()).filter(Boolean);
  const rawTelephones = contact.telephoneNumbers.map((t) => t.trim()).filter(Boolean);
  // Anything already flagged invalid on a prior pass (e.g. re-validating an
  // edited contact) is re-checked too, in case the person just fixed it.
  const rawPreviouslyInvalidMobiles = (contact.invalidMobileNumbers ?? []).map((m) => m.trim()).filter(Boolean);
  const rawPreviouslyInvalidTelephones = (contact.invalidTelephoneNumbers ?? []).map((t) => t.trim()).filter(Boolean);

  const mobilePartition = partitionPhoneNumbers([...rawMobiles, ...rawPreviouslyInvalidMobiles]);
  const telephonePartition = partitionPhoneNumbers([...rawTelephones, ...rawPreviouslyInvalidTelephones]);

  const mobileNumbers = mobilePartition.valid;
  const telephoneNumbers = telephonePartition.valid;
  const invalidMobileNumbers = mobilePartition.invalid;
  const invalidTelephoneNumbers = telephonePartition.invalid;

  const totalInvalidPhones = invalidMobileNumbers.length + invalidTelephoneNumbers.length;
  if (totalInvalidPhones > 0) {
    warnings.push(
      `${totalInvalidPhones} phone number${totalInvalidPhones > 1 ? "s" : ""} ` +
        `couldn't be validated and ${totalInvalidPhones > 1 ? "were" : "was"} flagged for review: ` +
        `${[...invalidMobileNumbers, ...invalidTelephoneNumbers].join(", ")}`
    );
  }

  // ----------------------------------------
  // Name / Company validation
  // ----------------------------------------

  if (
    !contact.fullName?.trim() &&
    !contact.company?.trim()
  ) {
    errors.push(
      "Contact is missing both full name and company."
    );
  }

  // ----------------------------------------
  // Email / Phone presence validation
  // ----------------------------------------
  // Only VALID phone numbers count toward "has a contact method" — an
  // unverified/invalid number shouldn't be enough to satisfy this check.

  if (
    requireContactMethod &&
    emails.length === 0 &&
    mobileNumbers.length === 0 &&
    telephoneNumbers.length === 0
  ) {
    errors.push(
      "Contact is missing email and phone information."
    );
  }

  // ----------------------------------------
  // Email format validation
  // ----------------------------------------

  const invalidEmails = emails.filter(
    (email) => !isValidEmail(email)
  );

  if (invalidEmails.length > 0) {
    errors.push(
      `Invalid email addresses found: ${invalidEmails.join(", ")}`
    );
  }

  // ----------------------------------------
  // Website validation
  // ----------------------------------------

  if (
    contact.website &&
    contact.website.trim() === ""
  ) {
    errors.push("Website value is empty.");
  }

  return {
    contact: {
      ...contact,
      emails,
      mobileNumbers,
      telephoneNumbers,
      invalidMobileNumbers,
      invalidTelephoneNumbers,
    },
    errors,
    warnings,
  };
}
