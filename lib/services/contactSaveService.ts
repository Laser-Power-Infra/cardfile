import { prisma } from "@/lib/prisma";
import type {
  ImportReport,
  ImportResult,
  NormalizedContact,
} from "@/types/contact";
import { validateNormalizedContact } from "@/lib/validators/contactValidator";
import {
  findExistingContact,
  buildMergedContactData,
} from "@/lib/duplicate/contactDuplicate";

interface SaveResult {
  status: "created" | "merged" | "skipped" | "failed";
  row: number | undefined;
  errors?: string[];
}

export async function saveNormalizedContacts(
  contacts: NormalizedContact[]
): Promise<ImportResult> {
  const report: ImportReport = {
    success: true,
    imported: 0,
    duplicates: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  const savedContacts: NormalizedContact[] = [];

  for (const contact of contacts) {
    const validation = validateNormalizedContact(contact);

    if (validation.errors.length > 0) {
      report.failed += 1;
      report.errors.push({
        row: contact.sourceRow ?? 0,
        errors: validation.errors,
      });
      continue;
    }

    savedContacts.push(contact);

    const existing = await findExistingContact(contact);

    if (!existing) {
      console.log("=================================");
      console.log("Saving Contact");
      console.log("Full Name :", contact.fullName);
      console.log("Company   :", contact.company);
      console.log("Job Title :", contact.jobTitle);
      console.log("=================================");

      await prisma.contact.create({
        data: {
          fullName: contact.fullName,
          jobTitle: contact.jobTitle,
          company: contact.company,

          mobileNumbers: contact.mobileNumbers,
          telephoneNumbers: contact.telephoneNumbers,
          invalidMobileNumbers: contact.invalidMobileNumbers ?? [],
          invalidTelephoneNumbers: contact.invalidTelephoneNumbers ?? [],
          emails: contact.emails,

          website: contact.website,
          address: contact.address,
          companyLocation: contact.companyLocation,

          linkedin: contact.linkedin,
        },
      });

      report.imported += 1;
      continue;
    }

    const updateData = buildMergedContactData(existing, contact);

    if (!updateData) {
      report.duplicates += 1;
      continue;
    }

    console.log("=================================");
    console.log("Updating Contact");
    console.log("Full Name :", contact.fullName);
    console.log("Company   :", contact.company);
    console.log("Job Title :", contact.jobTitle);
    console.log("=================================");

    await prisma.contact.update({
      where: { id: existing.id },
      data: updateData,
    });

    report.updated += 1;
  }

  return {
    report,
    contacts: savedContacts,
  };
}