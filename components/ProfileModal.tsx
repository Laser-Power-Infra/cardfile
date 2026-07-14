"use client";

import { useEffect, useState } from "react";
import {
  X,
  Linkedin,
  Globe,
  Twitter,
  Github,
  ExternalLink,
  RefreshCw,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";

import type { CardData } from "@/types/card";
import type { PublicProfile, ProfileApiResponse } from "@/types/profile";

interface Props {
  contact: CardData | null;
  open: boolean;
  onClose: () => void;
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ConnectPill({
  href,
  icon,
  label,
}: {
  href: string | null;
  icon: React.ReactNode;
  label: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-sm text-slate-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      {icon}
      {label}
    </a>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#9A927E]">
      {children}
    </p>
  );
}

function BulletBlock({
  label,
  value,
  items,
}: {
  label: string;
  value?: string | null;
  items?: string[];
}) {
  if (!value && (!items || items.length === 0)) return null;

  return (
    <li className="text-[15px] leading-relaxed text-[#2B271F]">
      <span className="font-semibold">{label}:</span>{" "}
      {value && <span>{value}</span>}
      {items && items.length > 0 && (
        <ul className="ml-1 mt-1 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-[14px] text-[#4A4539]">
              <span className="mt-1 flex-shrink-0 text-[#B99A7D]">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3 className="mt-1 font-display text-2xl text-[#201C15]">{title}</h3>
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
        <ul className="space-y-3">{children}</ul>
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6 px-6 py-6">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-2/3 rounded bg-slate-200" />
          <div className="h-4 w-1/3 rounded bg-slate-200" />
        </div>
      </div>
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-slate-200" />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="h-40 rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

export default function ProfileModal({ contact, open, onClose }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFoundMessage, setNotFoundMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = (forceRefresh = false) => {
    if (!contact) return;

    setError(null);
    setNotFoundMessage(null);
    setLoading(true);

    fetch("/api/profile/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...contact, forceRefresh }),
    })
      .then(async (res) => {
        const json: ProfileApiResponse = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to fetch profile details.");
        }
        if (!json.data) {
          setNotFoundMessage(json.message || "No public professional profile could be found for this contact.");
          setProfile(null);
          return;
        }
        setProfile(json.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to fetch profile details."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setProfile(null);
    setNotFoundMessage(null);
    setError(null);
    if (open && contact) fetchProfile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact?.id, contact?.fullName]);

  if (!open || !contact) return null;

  const displayName = profile?.fullName ?? contact.fullName;
  const displayTitle = profile?.jobTitle ?? contact.jobTitle;
  const displayCompany = profile?.company ?? contact.company;

  const career = profile?.career;
  const companyInfo = profile?.companyInfo;

  const hasCareer =
    career &&
    (career.currentRole ||
      career.trajectory.length > 0 ||
      career.education.length > 0 ||
      career.certifications.length > 0 ||
      career.awards.length > 0 ||
      career.skills.length > 0 ||
      career.languages.length > 0 ||
      career.notableAchievements.length > 0);

  const hasCompanyInfo =
    companyInfo &&
    (companyInfo.overview ||
      companyInfo.founded ||
      companyInfo.headquarters ||
      companyInfo.coreBusiness ||
      companyInfo.productsAndServices.length > 0 ||
      companyInfo.industry ||
      companyInfo.keyLeadership.length > 0 ||
      companyInfo.marketPosition);

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} aria-hidden />

      <aside className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="relative border-b border-slate-200 px-6 pb-6 pt-6">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 shadow-sm transition-colors hover:bg-slate-200"
            aria-label="Close profile"
          >
            <X className="h-4.5 w-4.5" />
          </button>

          <div className="flex items-start gap-4 pr-12">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={displayName ?? "Profile photo"}
                className="h-20 w-20 flex-shrink-0 rounded-full border-2 border-white object-cover shadow-md"
              />
            ) : (
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full border-2 border-white bg-sky-100 text-2xl font-display text-[#5C5748] shadow-md">
                {initials(displayName)}
              </div>
            )}

            <div className="min-w-0 flex-1 pt-1">
              <h2 className="font-display text-3xl leading-tight text-[#201C15]">
                {displayName ?? "Unknown contact"}
              </h2>
              {displayTitle && (
                <p className="mt-0.5 font-display text-lg italic text-[#6B6455]">{displayTitle}</p>
              )}
              {displayCompany && (
                <span className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-blue-700">
                  {displayCompany}
                </span>
              )}
            </div>
          </div>

          {/* Connect */}
          {profile && (
            <div className="mt-5">
              <Eyebrow>Connect</Eyebrow>
              <div className="mt-1 border-t border-slate-200 pt-3" />
              <div className="flex flex-wrap gap-2">
                <ConnectPill href={profile.links.linkedin} icon={<Linkedin className="h-3.5 w-3.5" />} label="LinkedIn" />
                <ConnectPill
                  href={profile.links.companyWebsite}
                  icon={<Globe className="h-3.5 w-3.5" />}
                  label={companyDomainLabel(profile.links.companyWebsite)}
                />
                <ConnectPill
                  href={profile.links.personalWebsite}
                  icon={<Globe className="h-3.5 w-3.5" />}
                  label="Website"
                />
                <ConnectPill href={profile.links.twitter} icon={<Twitter className="h-3.5 w-3.5" />} label="X / Twitter" />
                <ConnectPill href={profile.links.github} icon={<Github className="h-3.5 w-3.5" />} label="GitHub" />
                <ConnectPill
                  href={profile.links.crunchbase}
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  label="Crunchbase"
                />
                <ConnectPill
                  href={profile.links.angellist}
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  label="AngelList"
                />
                <ConnectPill
                  href={profile.links.arounddeal}
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                  label="AroundDeal"
                />
                <ConnectPill href={profile.links.tracxn} icon={<ExternalLink className="h-3.5 w-3.5" />} label="Tracxn" />
                {profile.links.other.map((link) => (
                  <ConnectPill
                    key={link.url}
                    href={link.url}
                    icon={<ExternalLink className="h-3.5 w-3.5" />}
                    label={hostLabel(link.url) ?? link.label}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {loading && <LoadingSkeleton />}

          {!loading && error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          )}

          {!loading && !error && notFoundMessage && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm text-[#5C5748]">{notFoundMessage}</p>
              <button
                onClick={() => fetchProfile(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#201C15] px-4 py-2 text-sm font-medium text-white hover:bg-[#3A362E]"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </button>
            </div>
          )}

          {!loading && !error && profile && (
            <>
              {profile.aiSummary && (
                <section>
                  <Eyebrow>AI Summary</Eyebrow>
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <p className="text-[15px] leading-relaxed text-[#2B271F]">{profile.aiSummary}</p>
                  </div>
                </section>
              )}

              {hasCareer && (
                <Section eyebrow="Personal Profile" title="Career & background">
                  <BulletBlock label="Current Role" value={career!.currentRole ?? undefined} />
                  <BulletBlock label="Career Trajectory" items={career!.trajectory} />
                  <BulletBlock label="Education" items={career!.education} />
                  <BulletBlock label="Certifications" items={career!.certifications} />
                  <BulletBlock label="Awards" items={career!.awards} />
                  <BulletBlock label="Skills" items={career!.skills} />
                  <BulletBlock label="Languages" items={career!.languages} />
                  <BulletBlock label="Notable Achievements" items={career!.notableAchievements} />
                </Section>
              )}

              {hasCompanyInfo && (
                <Section eyebrow="Company" title={companyInfo!.name ?? displayCompany ?? "Company"}>
                  <BulletBlock label="Overview" value={companyInfo!.overview ?? undefined} />
                  <BulletBlock label="Founded" value={companyInfo!.founded ?? undefined} />
                  <BulletBlock label="Headquarters" value={companyInfo!.headquarters ?? undefined} />
                  <BulletBlock label="Core Business" value={companyInfo!.coreBusiness ?? undefined} />
                  <BulletBlock label="Products / Services" items={companyInfo!.productsAndServices} />
                  <BulletBlock label="Industry / Sector" value={companyInfo!.industry ?? undefined} />
                  <BulletBlock label="Key Leadership" items={companyInfo!.keyLeadership} />
                  <BulletBlock label="Market Position" value={companyInfo!.marketPosition ?? undefined} />
                  <BulletBlock label="Company Size" value={companyInfo!.companySize ?? undefined} />
                  <BulletBlock label="Funding" value={companyInfo!.funding ?? undefined} />
                  <BulletBlock label="Revenue" value={companyInfo!.revenue ?? undefined} />
                </Section>
              )}

              {profile.sources.length > 0 && (
                <section>
                  <Eyebrow>Sources</Eyebrow>
                  <ul className="mt-3 space-y-1.5">
                    {profile.sources.slice(0, 6).map((source) => (
                      <li key={source.url} className="truncate text-xs text-[#9A927E]">
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#6B6455] hover:underline">
                          {source.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {/* Verified contact information — always from our own data, never from search */}
          <section>
            <Eyebrow>Contact Information</Eyebrow>
            <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-[15px] text-slate-700 shadow-sm">
              {contact.emails?.map((email) => (
                <p key={email} className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#9A927E]" />
                  <a href={`mailto:${email}`} className="hover:text-[#6B6455]">{email}</a>
                </p>
              ))}
              {contact.mobileNumbers?.map((phone) => (
                <p key={phone} className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#9A927E]" />
                  <a href={`tel:${phone}`} className="hover:text-[#6B6455]">{phone}</a>
                </p>
              ))}
              {contact.website && (
                <div className="flex items-start gap-2">
                  <Globe className="mt-1 h-4 w-4 shrink-0 text-[#9A927E]" />

                  <a
                    href={contact.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-slate-700 hover:text-[#6B6455]"
                  >
                    {contact.website.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
              {contact.address && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#9A927E]" />
                  {contact.address}
                </p>
              )}
              {!contact.emails?.length && !contact.mobileNumbers?.length && !contact.website && !contact.address && (
                <p className="text-[#9A927E]">No verified contact details on file.</p>
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function hostLabel(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function companyDomainLabel(url: string | null): string {
  if (!url) return "Company site";
  return hostLabel(url) ?? "Company site";
}
