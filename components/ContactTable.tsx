"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Loader2, X as XIcon } from "lucide-react";

import type { CardData } from "@/types/card";
import EditContactModal from "./EditContactModal";
import { deleteContact } from "@/lib/client/deleteContact";

type ContactTableProps = {
  contacts: CardData[];
  pageSize?: number;
  /** Called with the freshly-saved contact after a successful edit, so the parent's master list stays in sync. */
  onContactUpdated?: (updated: CardData) => void;
  /** Called with the deleted contact's id after a successful delete, so the parent's master list stays in sync. */
  onContactDeleted?: (id: string) => void;
};

interface CompanyBriefState {
  status: "loading" | "done" | "empty" | "error";
  overview?: string;
}

/** How many company-brief lookups run at once — keeps a big contact list from firing 50 parallel OpenAI calls at once. */
const BRIEF_CONCURRENCY = 3;

// ==========================================
// Column visibility
// Clicking a header shows ONLY that column (plus Actions, which is
// always visible). Clicking the same header again — or the "Show all"
// button — restores every column.
// ==========================================
type ColumnKey =
  | "name"
  | "company"
  | "jobTitle"
  | "email"
  | "mobile"
  | "telephone"
  | "website"
  | "brief";

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "company", label: "Company" },
  { key: "jobTitle", label: "Job Title" },
  { key: "email", label: "Email" },
  { key: "mobile", label: "Mobile" },
  { key: "telephone", label: "Telephone" },
  { key: "website", label: "Website" },
  { key: "brief", label: "Company Brief" },
];

export default function ContactTable({
  contacts,
  pageSize = 10,
  onContactUpdated,
  onContactDeleted,
}: ContactTableProps) {
  const [page, setPage] = useState(1);

  const [editingContact, setEditingContact] =
    useState<CardData | null>(null);

  const [isEditOpen, setIsEditOpen] =
    useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // null = show every column. Otherwise, show only the clicked column.
  const [activeColumn, setActiveColumn] = useState<ColumnKey | null>(null);

  const showColumn = (key: ColumnKey) =>
    activeColumn === null || activeColumn === key;

  const toggleColumn = (key: ColumnKey) =>
    setActiveColumn((prev) => (prev === key ? null : key));

  const [companyBriefs, setCompanyBriefs] = useState<Record<string, CompanyBriefState>>({});

  // ==========================================
  // Deduplicate contacts
  // Priority:
  // Email -> Mobile -> Telephone -> Name+Company
  // ==========================================
  const deduped = useMemo(() => {
    const seen = new Map<string, CardData>();

    const makeKey = (contact: CardData) => {
      const email =
        contact.emails?.[0]?.toLowerCase() ?? "";

      const mobile =
        contact.mobileNumbers?.[0] ?? "";

      const telephone =
        contact.telephoneNumbers?.[0] ?? "";

      const phone = mobile || telephone;

      const nameCompany = `${contact.fullName ?? ""}|${contact.company ?? ""
        }`;

      if (email) {
        return `email:${email}`;
      }

      if (phone) {
        return `phone:${phone.replace(
          /[\s+-]/g,
          ""
        )}`;
      }

      return `namecompany:${nameCompany.toLowerCase()}`;
    };

    for (const contact of contacts) {
      const key = makeKey(contact);

      if (!seen.has(key)) {
        seen.set(key, contact);
      }
    }

    return Array.from(seen.values());
  }, [contacts]);

  // `filtered` name kept as-is below (pagination, company-brief lookup,
  // etc. all key off it) — it's just the deduped list now that the
  // field-level filter bar has been removed.
  const filtered = deduped;

  // ==========================================
  // Auto-fetch a Company Brief for every unique company in the current
  // (filtered) list. Deduped by company name so contacts sharing an
  // employer only trigger one lookup, and cached server-side for 7 days so
  // reloading the table doesn't re-charge for a company already looked up
  // recently.
  // ==========================================
  useEffect(() => {
    const uniqueCompanies = Array.from(
      new Set(
        filtered
          .map((c) => c.company?.trim())
          .filter((c): c is string => Boolean(c))
      )
    ).filter((company) => !companyBriefs[company]);

    if (uniqueCompanies.length === 0) return;

    let cancelled = false;

    setCompanyBriefs((prev) => {
      const next = { ...prev };
      for (const company of uniqueCompanies) next[company] = { status: "loading" };
      return next;
    });

    async function fetchBrief(company: string) {
      try {
        const res = await fetch("/api/company-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company }),
        });
        const json = await res.json();

        if (cancelled) return;

        setCompanyBriefs((prev) => ({
          ...prev,
          [company]:
            json.success && json.data?.overview
              ? { status: "done", overview: json.data.overview }
              : { status: "empty" },
        }));
      } catch {
        if (!cancelled) {
          setCompanyBriefs((prev) => ({ ...prev, [company]: { status: "error" } }));
        }
      }
    }

    // Simple concurrency-limited queue so a big contact list doesn't fire
    // dozens of parallel OpenAI web-search calls at once.
    async function runQueue() {
      let index = 0;
      async function worker() {
        while (index < uniqueCompanies.length && !cancelled) {
          const company = uniqueCompanies[index++];
          await fetchBrief(company);
        }
      }
      await Promise.all(Array.from({ length: BRIEF_CONCURRENCY }, worker));
    }

    runQueue();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered]);

  // ==========================================
  // Pagination
  // ==========================================
  const total = filtered.length;

  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  );

  const pageStart = (page - 1) * pageSize;

  const pageItems = filtered.slice(
    pageStart,
    pageStart + pageSize
  );

  // Prevent page overflow
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function handleDelete(contact: CardData) {
    if (!contact.id) return;

    const confirmed = window.confirm(
      `Delete ${contact.fullName || contact.company || "this contact"}? This can't be undone.`
    );
    if (!confirmed) return;

    setDeleteError(null);
    setDeletingId(contact.id);

    try {
      await deleteContact(contact.id);
      onContactDeleted?.(contact.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete contact.");
    } finally {
      setDeletingId(null);
    }
  }

  if (deduped.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 p-6 text-center text-slate-500">
        No contacts found
      </div>
    );
  }

  return (
    <div>
      {activeColumn && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          <span>
            Showing only the{" "}
            <strong>{COLUMNS.find((c) => c.key === activeColumn)?.label}</strong> column
          </span>
          <button
            type="button"
            onClick={() => setActiveColumn(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 hover:text-sky-900"
          >
            <XIcon size={14} />
            Show all columns
          </button>
        </div>
      )}

      {deleteError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {deleteError}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full table-auto border-collapse text-sm text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                  {COLUMNS.filter((col) => showColumn(col.key)).map((col) => (
                    <th key={col.key} className="px-4 py-3 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleColumn(col.key)}
                        title={
                          activeColumn === col.key
                            ? "Click to show all columns"
                            : `Click to show only ${col.label}`
                        }
                        className={`uppercase tracking-[0.16em] transition ${
                          activeColumn === col.key
                            ? "text-sky-600"
                            : "hover:text-slate-800"
                        }`}
                      >
                        {col.label}
                      </button>
                    </th>
                  ))}

                  <th className="px-4 py-3 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {pageItems.map((contact, index) => {
                  const brief = contact.company ? companyBriefs[contact.company.trim()] : undefined;

                  return (
                    <tr
                      key={`${contact.emails?.[0] ||
                        contact.mobileNumbers?.[0] ||
                        contact.fullName ||
                        index
                        }`}
                      className="border-b border-slate-200 transition-colors hover:bg-sky-50"
                    >
                      {showColumn("name") && (
                        <td className="px-4 py-3">
                          {contact.fullName || "-"}
                        </td>
                      )}

                      {showColumn("company") && (
                        <td className="px-4 py-3">
                          {contact.company || "-"}
                        </td>
                      )}

                      {showColumn("jobTitle") && (
                        <td className="px-4 py-3">
                          {contact.jobTitle || "-"}
                        </td>
                      )}

                      {showColumn("email") && (
                        <td className="px-4 py-3">
                          {contact.emails?.[0] || "-"}
                        </td>
                      )}

                      {showColumn("mobile") && (
                        <td className="px-4 py-3">
                          {contact.mobileNumbers?.[0] || "-"}
                        </td>
                      )}

                      {showColumn("telephone") && (
                        <td className="px-4 py-3">
                          {contact.telephoneNumbers?.[0] || "-"}
                        </td>
                      )}

                      {showColumn("website") && (
                        <td className="px-4 py-3">
                          {contact.website ? (
                            <a
                              href={contact.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-600 underline hover:text-sky-800"
                            >
                              Visit
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                      )}

                      {/* =========================
                          COMPANY BRIEF COLUMN
                      ========================== */}
                      {showColumn("brief") && (
                        <td className="max-w-xs px-4 py-3">
                          {!contact.company ? (
                            "-"
                          ) : !brief || brief.status === "loading" ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                              <Loader2 size={12} className="animate-spin" />
                              Looking up...
                            </span>
                          ) : brief.status === "done" ? (
                            <p className="line-clamp-2 text-xs text-slate-600" title={brief.overview}>
                              {brief.overview}
                            </p>
                          ) : brief.status === "error" ? (
                            <span className="text-xs text-red-500">Lookup failed</span>
                          ) : (
                            <span className="text-xs text-slate-400">No public info found</span>
                          )}
                        </td>
                      )}

                      {/* =========================
                          ACTIONS COLUMN
                      ========================== */}

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContact(contact);
                              setIsEditOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-white transition hover:bg-blue-700"
                          >
                            <Pencil size={16} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(contact)}
                            disabled={deletingId === contact.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === contact.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              </tbody>
            </table>
          </div>

          {/* =========================
              Pagination Controls
          ========================== */}

          <div className="mt-3 flex items-center justify-between">

            <div className="text-sm text-slate-600">
              Showing {pageStart + 1}-
              {Math.min(pageStart + pageSize, total)} of {total}
            </div>

            <div className="flex items-center gap-2">

              <button
                type="button"
                onClick={() =>
                  setPage((previous) =>
                    Math.max(1, previous - 1)
                  )
                }
                disabled={page === 1}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-slate-700 disabled:opacity-50"
              >
                Prev
              </button>

              <div className="hidden items-center gap-1 sm:flex">

                {Array.from({
                  length: totalPages,
                }).map((_, index) => (

                  <button
                    key={index}
                    type="button"
                    onClick={() =>
                      setPage(index + 1)
                    }
                    className={`rounded-md border px-3 py-1 ${page === index + 1
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                      }`}
                  >
                    {index + 1}
                  </button>

                ))}

              </div>

              <button
                type="button"
                onClick={() =>
                  setPage((previous) =>
                    Math.min(totalPages, previous + 1)
                  )
                }
                disabled={page === totalPages}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-slate-700 disabled:opacity-50"
              >
                Next
              </button>

            </div>

          </div>

      {/* =========================
          Edit Contact Modal
      ========================== */}

      <EditContactModal
        open={isEditOpen}
        contact={editingContact}
        onClose={() => {
          setIsEditOpen(false);
          setEditingContact(null);
        }}
        onSaved={(updatedContact) => {
          // Close the modal
          setIsEditOpen(false);

          // Keep the updated contact selected
          setEditingContact(updatedContact);

          // Tell the parent (app/page.tsx) about the change so the master
          // `contacts` list — and therefore both the table AND the card
          // view, which both render off that same list — reflect the edit
          // immediately instead of showing stale data.
          onContactUpdated?.(updatedContact);
        }}
      />
    </div>
  );
}
