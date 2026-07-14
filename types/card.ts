export interface CardData {
  id: string;

  fullName: string | null;
  jobTitle: string | null;
  company: string | null;

  mobileNumbers: string[];
  telephoneNumbers: string[];

  /** Numbers that failed phone validation — kept for manual review, never shown as if they were verified. */
  invalidMobileNumbers?: string[];
  invalidTelephoneNumbers?: string[];

  emails: string[];

  website: string | null;
  address: string | null;
  companyLocation: string | null;

  linkedin: string | null;

  otherSocials: {
    label: string;
    url: string;
  }[];

  rawNotes: string | null;
}

export interface ScanResponse {
  success: boolean;
  data?: CardData | CardData[];
  error?: string;
}