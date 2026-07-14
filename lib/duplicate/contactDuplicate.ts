import { prisma } from "@/lib/prisma";
import { NormalizedContact } from "@/types/contact";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9+]/g, "");
}

export function buildContactMatchCondition(contact: NormalizedContact) {
  const clauses: any[] = [];

  for (const email of contact.emails) {
    const normalized = normalizeEmail(email);
    if (normalized) {
      clauses.push({ emails: { has: normalized } });
    }
  }

  for (const number of contact.mobileNumbers) {
    const normalized = normalizePhone(number);
    if (normalized) {
      clauses.push({ mobileNumbers: { has: normalized } });
  }
  }

  for (const number of contact.telephoneNumbers) {
    const normalized = normalizePhone(number);
    if (normalized) {
      clauses.push({ telephoneNumbers: { has: normalized } });
    }
  }

  if (contact.fullName && contact.company) {
    clauses.push({ AND: [{ fullName: contact.fullName }, { company: contact.company }] });
  }

  return clauses.length > 0 ? { OR: clauses } : undefined;
}

export async function findExistingContact(contact: NormalizedContact) {
  const where = buildContactMatchCondition(contact);
  if (!where) {
    return null;
  }

  return prisma.contact.findFirst({ where });
}

interface ExistingContactRecord {
  emails?: unknown[];
  mobileNumbers?: unknown[];
  telephoneNumbers?: unknown[];
  invalidMobileNumbers?: unknown[];
  invalidTelephoneNumbers?: unknown[];
  jobTitle?: string | null;
  company?: string | null;
  website?: string | null;
  address?: string | null;
  companyLocation?: string | null;
  linkedin?: string | null;
  fullName?: string | null;
  rawNotes?: string | null;
}

export function buildMergedContactData(existing: ExistingContactRecord, incoming: NormalizedContact) {
  const data: any = {};

  const city = existing.companyLocation;
  const currentEmails: string[] = Array.isArray(existing.emails)
    ? existing.emails.map((value) => String(value).toLowerCase())
    : [];
  const currentMobiles: string[] = Array.isArray(existing.mobileNumbers)
    ? existing.mobileNumbers.map((value) => String(value))
    : [];
  const currentTelephones: string[] = Array.isArray(existing.telephoneNumbers)
    ? existing.telephoneNumbers.map((value) => String(value))
    : [];

  const mergedEmails = new Set<string>(currentEmails);
  incoming.emails.forEach((email) => mergedEmails.add(email.toLowerCase()));

  const mergedMobiles = new Set(currentMobiles);
  incoming.mobileNumbers.forEach((phone) => mergedMobiles.add(phone));

  const mergedTelephones = new Set(currentTelephones);
  incoming.telephoneNumbers.forEach((phone) => mergedTelephones.add(phone));

  if (mergedEmails.size > currentEmails.length) {
    data.emails = Array.from(mergedEmails);
  }

  if (mergedMobiles.size > currentMobiles.length) {
    data.mobileNumbers = Array.from(mergedMobiles);
  }

  if (mergedTelephones.size > currentTelephones.length) {
    data.telephoneNumbers = Array.from(mergedTelephones);
  }

  const currentInvalidMobiles: string[] = Array.isArray(existing.invalidMobileNumbers)
    ? existing.invalidMobileNumbers.map((value) => String(value))
    : [];
  const currentInvalidTelephones: string[] = Array.isArray(existing.invalidTelephoneNumbers)
    ? existing.invalidTelephoneNumbers.map((value) => String(value))
    : [];

  const mergedInvalidMobiles = new Set(currentInvalidMobiles);
  (incoming.invalidMobileNumbers ?? []).forEach((phone) => mergedInvalidMobiles.add(phone));

  const mergedInvalidTelephones = new Set(currentInvalidTelephones);
  (incoming.invalidTelephoneNumbers ?? []).forEach((phone) => mergedInvalidTelephones.add(phone));

  if (mergedInvalidMobiles.size > currentInvalidMobiles.length) {
    data.invalidMobileNumbers = Array.from(mergedInvalidMobiles);
  }

  if (mergedInvalidTelephones.size > currentInvalidTelephones.length) {
    data.invalidTelephoneNumbers = Array.from(mergedInvalidTelephones);
  }

  if (incoming.jobTitle && !existing.jobTitle) {
    data.jobTitle = incoming.jobTitle;
  }
  if (incoming.company && !existing.company) {
    data.company = incoming.company;
  }
  if (incoming.website && !existing.website) {
    data.website = incoming.website;
  }
  if (incoming.address && !existing.address) {
    data.address = incoming.address;
  }
  if (incoming.companyLocation && !existing.companyLocation) {
    data.companyLocation = incoming.companyLocation;
  }
  if (incoming.linkedin && !existing.linkedin) {
    data.linkedin = incoming.linkedin;
  }
  if (incoming.fullName && !existing.fullName) {
    data.fullName = incoming.fullName;
  }

  return Object.keys(data).length ? data : null;
}
