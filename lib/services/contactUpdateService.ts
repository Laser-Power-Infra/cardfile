import { prisma } from "@/lib/prisma";
import type { ContactModel as Contact } from "@/lib/generated/prisma/models";
import { validateNormalizedContact } from "@/lib/validators/contactValidator";
import type { NormalizedContact } from "@/types/contact";

/** Thrown for expected failure cases so the API route can map them to the right HTTP status. */
export class ContactUpdateError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ContactUpdateError";
    this.status = status;
  }
}

/**
 * Updates a contact from a (possibly partial) edit-form payload.
 *
 * Two things this deliberately does differently from the import/create path:
 *
 * 1. It MERGES the incoming body onto the existing DB record instead of
 *    trusting the body to contain every field. This makes it safe even if a
 *    future caller only sends the fields that actually changed.
 *
 * 2. It validates with `requireContactMethod: false`. Some already-saved
 *    contacts (bad CSV rows, low-confidence OCR scans) never had an email or
 *    phone number to begin with — that's a pre-existing data-quality issue,
 *    not something this edit introduced, and it shouldn't block someone from
 *    fixing the name/company on that record.
 */
export async function updateContact(
  id: string,
  body: Partial<NormalizedContact>
): Promise<Contact> {
  const existing = await prisma.contact.findUnique({ where: { id } });

  if (!existing) {
    throw new ContactUpdateError("Contact not found.", 404);
  }

  // ----------------------------------------
  // Merge: anything not present in `body` keeps its current DB value.
  // ----------------------------------------
  const merged: NormalizedContact = {
    fullName: body.fullName !== undefined ? body.fullName : existing.fullName,
    jobTitle: body.jobTitle !== undefined ? body.jobTitle : existing.jobTitle,
    company: body.company !== undefined ? body.company : existing.company,
    mobileNumbers: body.mobileNumbers ?? existing.mobileNumbers,
    telephoneNumbers: body.telephoneNumbers ?? existing.telephoneNumbers,
    invalidMobileNumbers: body.invalidMobileNumbers ?? (existing as any).invalidMobileNumbers ?? [],
    invalidTelephoneNumbers:
      body.invalidTelephoneNumbers ?? (existing as any).invalidTelephoneNumbers ?? [],
    emails: body.emails ?? existing.emails,
    website: body.website !== undefined ? body.website : existing.website,
    address: body.address !== undefined ? body.address : existing.address,
    companyLocation:
      body.companyLocation !== undefined ? body.companyLocation : existing.companyLocation,
    linkedin: body.linkedin !== undefined ? body.linkedin : existing.linkedin,
    otherSocials: [],
    photo: null,
  };

  // ----------------------------------------
  // Validate (edit mode: don't require an email/phone that never existed)
  // ----------------------------------------
  const validation = validateNormalizedContact(merged, { requireContactMethod: false });

  if (validation.errors.length > 0) {
    throw new ContactUpdateError(validation.errors.join(", "), 422);
  }

  const { emails, mobileNumbers, telephoneNumbers, invalidMobileNumbers, invalidTelephoneNumbers } =
    validation.contact;

  // ----------------------------------------
  // Guard against silently merging into a DIFFERENT contact: if the edited
  // email/phone now matches someone else's record, stop instead of letting
  // two people's data collide.
  // ----------------------------------------
  const collisionClauses = [
    ...emails.map((email) => ({ emails: { has: email.toLowerCase() } })),
    ...mobileNumbers.map((phone) => ({ mobileNumbers: { has: phone } })),
    ...telephoneNumbers.map((phone) => ({ telephoneNumbers: { has: phone } })),
  ];

  if (collisionClauses.length > 0) {
    const collision = await prisma.contact.findFirst({
      where: { AND: [{ id: { not: id } }, { OR: collisionClauses }] },
    });

    if (collision) {
      throw new ContactUpdateError(
        `This email or phone number already belongs to another contact (${
          collision.fullName ?? collision.id
        }).`,
        409
      );
    }
  }

  // ----------------------------------------
  // Update
  // ----------------------------------------
  const updated = await prisma.contact.update({
    where: { id },
    data: {
      fullName: merged.fullName,
      jobTitle: merged.jobTitle,
      company: merged.company,
      mobileNumbers,
      telephoneNumbers,
      invalidMobileNumbers: invalidMobileNumbers ?? [],
      invalidTelephoneNumbers: invalidTelephoneNumbers ?? [],
      emails,
      website: merged.website,
      address: merged.address,
      companyLocation: merged.companyLocation,
      linkedin: merged.linkedin,
    },
  });

  return updated;
}
