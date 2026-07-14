/**
 * Types for the "View Profile" drawer (public professional profile lookup).
 *
 * IMPORTANT: every field here must only ever be populated from information
 * actually found in real search results. Nothing is invented. When a fact
 * can't be confirmed, the model is instructed to say so explicitly (e.g.
 * "exact start date not publicly available") rather than silently guessing
 * or omitting the field.
 */

export interface PublicLink {
  label: string;
  url: string;
}

export interface SourceRef {
  label: string;
  url: string;
  snippet?: string;
}

export interface CareerBackground {
  currentRole: string | null;
  /** Freeform one-line trajectory entries, e.g. "Partner, IB Leader at EY (prior role; dates not publicly available)". */
  trajectory: string[];
  education: string[];
  certifications: string[];
  awards: string[];
  skills: string[];
  languages: string[];
  notableAchievements: string[];
}

export interface CompanyInfo {
  name: string | null;
  logoUrl: string | null;
  industry: string | null;
  overview: string | null;
  founded: string | null;
  headquarters: string | null;
  coreBusiness: string | null;
  productsAndServices: string[];
  companySize: string | null;
  funding: string | null;
  revenue: string | null;
  keyLeadership: string[];
  marketPosition: string | null;
  website: string | null;
}

export interface PublicProfile {
  fullName: string | null;
  jobTitle: string | null;
  company: string | null;
  location: string | null;
  avatarUrl: string | null;

  links: {
    linkedin: string | null;
    companyWebsite: string | null;
    personalWebsite: string | null;
    twitter: string | null;
    github: string | null;
    crunchbase: string | null;
    angellist: string | null;
    arounddeal: string | null;
    tracxn: string | null;
    other: PublicLink[];
  };

  career: CareerBackground;
  companyInfo: CompanyInfo;

  /** 150-250 word narrative summary, grounded only in `sources`. */
  aiSummary: string | null;

  sources: SourceRef[];

  /** ISO timestamp — used for the 7-day cache TTL. */
  fetchedAt: string;
}

export interface ProfileApiResponse {
  success: boolean;
  data: PublicProfile | null;
  cached?: boolean;
  message?: string;
  error?: string;
}
