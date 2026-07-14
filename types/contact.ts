export interface RawContactRow {
  [key: string]: string | number | null | undefined;
  sourceRow?: number;
  sheetName?: string;
  rawVCard?: string;
}

export interface NormalizedContact {
  fullName: string | null;
  jobTitle: string | null;
  company: string | null;
  mobileNumbers: string[];
  telephoneNumbers: string[];
  /**
   * Numbers that were extracted (from OCR/CSV/Excel/manual entry) but failed
   * structural phone validation (see lib/validators/phoneValidator.ts).
   * Kept — not dropped — so a person can see and manually correct an OCR
   * misread instead of silently losing the number.
   */
  invalidMobileNumbers?: string[];
  invalidTelephoneNumbers?: string[];
  emails: string[];
  website: string | null;
  address: string | null;
  companyLocation: string | null;
  linkedin: string | null;
  otherSocials: { label: string; url: string }[];
  photo: string | null;
  sourceRow?: number;
}

export interface ValidationResult {
  contact: NormalizedContact;
  errors: string[];
  /** Non-blocking issues (e.g. "2 phone numbers looked invalid") — save still proceeds. */
  warnings: string[];
}

export interface ImportReport {
  success: boolean;
  imported: number;
  duplicates: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; errors: string[] }>;
}

export interface ImportResult {
  report: ImportReport;
  contacts: NormalizedContact[];
}
