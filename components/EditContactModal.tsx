"use client";

import { useEffect, useState } from "react";
import { X, Save } from "lucide-react";

import type { CardData } from "@/types/card";

interface EditContactModalProps {
    open: boolean;
    contact: CardData | null;
    onClose: () => void;
    onSaved?: (updatedContact: CardData) => void;
}

export default function EditContactModal({
    open,
    contact,
    onClose,
    onSaved,
}: EditContactModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState({
        fullName: "",
        jobTitle: "",
        company: "",

        mobileNumbers: [""],

        telephoneNumbers: [""],

        emails: [""],

        website: "",

        address: "",

        companyLocation: "",

        linkedin: "",
    });

    useEffect(() => {
        if (!contact) return;

        setForm({
            fullName: contact.fullName ?? "",

            jobTitle: contact.jobTitle ?? "",

            company: contact.company ?? "",

            mobileNumbers:
                contact.mobileNumbers.length > 0
                    ? [...contact.mobileNumbers]
                    : [""],

            telephoneNumbers:
                contact.telephoneNumbers.length > 0
                    ? [...contact.telephoneNumbers]
                    : [""],

            emails:
                contact.emails.length > 0
                    ? [...contact.emails]
                    : [""],

            website: contact.website ?? "",

            address: contact.address ?? "",

            companyLocation: contact.companyLocation ?? "",

            linkedin: contact.linkedin ?? "",
        });

        setError(null);
    }, [contact]);

    function updateField(
        key: keyof typeof form,
        value: string
    ) {
        setForm((previous) => ({
            ...previous,
            [key]: value,
        }));
    }

    function updateArrayField(
        key:
            | "mobileNumbers"
            | "telephoneNumbers"
            | "emails",
        index: number,
        value: string
    ) {
        setForm((previous) => {
            const updated = [...previous[key]];
            updated[index] = value;

            return {
                ...previous,
                [key]: updated,
            };
        });
    }

    function addArrayItem(
        key:
            | "mobileNumbers"
            | "telephoneNumbers"
            | "emails"
    ) {
        setForm((previous) => ({
            ...previous,
            [key]: [...previous[key], ""],
        }));
    }

    function removeArrayItem(
        key:
            | "mobileNumbers"
            | "telephoneNumbers"
            | "emails",
        index: number
    ) {
        setForm((previous) => {
            const updated = previous[key].filter(
                (_, i) => i !== index
            );

            return {
                ...previous,
                [key]:
                    updated.length > 0
                        ? updated
                        : [""],
            };
        });
    }

    if (!open || !contact) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
            <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">

                {/* Header */}

                <div className="flex items-center justify-between border-b p-6">

                    <div>

                        <h2 className="text-2xl font-bold">
                            Edit Contact
                        </h2>

                        <p className="text-sm text-gray-500">
                            Update contact information
                        </p>

                    </div>

                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 hover:bg-gray-100"
                    >
                        <X size={20} />
                    </button>

                </div>

                {/* Form starts here */}

                <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6">

                    {/* =========================
    Basic Information
========================= */}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                        {/* Full Name */}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                Full Name
                            </label>

                            <input
                                type="text"
                                value={form.fullName}
                                onChange={(e) =>
                                    updateField("fullName", e.target.value)
                                }
                                className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                                placeholder="Full Name"
                            />
                        </div>

                        {/* Job Title */}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                Job Title
                            </label>

                            <input
                                type="text"
                                value={form.jobTitle}
                                onChange={(e) =>
                                    updateField("jobTitle", e.target.value)
                                }
                                className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                                placeholder="Job Title"
                            />
                        </div>

                        {/* Company */}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                Company
                            </label>

                            <input
                                type="text"
                                value={form.company}
                                onChange={(e) =>
                                    updateField("company", e.target.value)
                                }
                                className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                                placeholder="Company"
                            />
                        </div>

                        {/* Website */}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                                Website
                            </label>

                            <input
                                type="text"
                                value={form.website}
                                onChange={(e) =>
                                    updateField("website", e.target.value)
                                }
                                className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                                placeholder="https://example.com"
                            />
                        </div>

                    </div>

                    {/* ========================Mobile Numbers========================= */}

                    <div>

                        <div className="flex items-center justify-between mb-3">

                            <label className="text-sm font-medium text-gray-700">
                                Mobile Numbers
                            </label>

                            <button
                                type="button"
                                onClick={() => addArrayItem("mobileNumbers")}
                                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                            >
                                + Add
                            </button>

                        </div>

                        <div className="space-y-3">

                            {form.mobileNumbers.map((number, index) => (

                                <div
                                    key={index}
                                    className="flex gap-2"
                                >

                                    <input
                                        type="text"
                                        value={number}
                                        onChange={(e) =>
                                            updateArrayField(
                                                "mobileNumbers",
                                                index,
                                                e.target.value
                                            )
                                        }
                                        className="flex-1 rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                                        placeholder="+91 9876543210"
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            removeArrayItem(
                                                "mobileNumbers",
                                                index
                                            )
                                        }
                                        className="rounded-lg bg-red-500 px-4 text-white hover:bg-red-600"
                                    >
                                        Remove
                                    </button>

                                </div>

                            ))}

                        </div>

                    </div>

                    {/* =========================Telephone Numbers========================= */}

                    <div>

                        <div className="flex items-center justify-between mb-3">

                            <label className="text-sm font-medium text-gray-700">
                                Telephone Numbers
                            </label>

                            <button
                                type="button"
                                onClick={() =>
                                    addArrayItem("telephoneNumbers")
                                }
                                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                            >
                                + Add
                            </button>

                        </div>

                        <div className="space-y-3">

                            {form.telephoneNumbers.map((phone, index) => (

                                <div
                                    key={index}
                                    className="flex gap-2"
                                >

                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) =>
                                            updateArrayField(
                                                "telephoneNumbers",
                                                index,
                                                e.target.value
                                            )
                                        }
                                        className="flex-1 rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                                        placeholder="Telephone Number"
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            removeArrayItem(
                                                "telephoneNumbers",
                                                index
                                            )
                                        }
                                        className="rounded-lg bg-red-500 px-4 text-white hover:bg-red-600"
                                    >
                                        Remove
                                    </button>

                                </div>

                            ))}

                        </div>

                    </div>

                    {/* =========================Emails======================== */}

                    <div>

                        <div className="flex items-center justify-between mb-3">

                            <label className="text-sm font-medium text-gray-700">
                                Email Addresses
                            </label>

                            <button
                                type="button"
                                onClick={() => addArrayItem("emails")}
                                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                            >
                                + Add
                            </button>

                        </div>

                        <div className="space-y-3">

                            {form.emails.map((email, index) => (

                                <div
                                    key={index}
                                    className="flex gap-2"
                                >

                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) =>
                                            updateArrayField(
                                                "emails",
                                                index,
                                                e.target.value
                                            )
                                        }
                                        className="flex-1 rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                                        placeholder="Email Address"
                                    />

                                    <button
                                        type="button"
                                        onClick={() =>
                                            removeArrayItem(
                                                "emails",
                                                index
                                            )
                                        }
                                        className="rounded-lg bg-red-500 px-4 text-white hover:bg-red-600"
                                    >
                                        Remove
                                    </button>

                                </div>

                            ))}

                        </div>

                    </div>

                    {/* =========================Website========================= */}

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Website
                        </label>

                        <input
                            type="text"
                            value={form.website}
                            onChange={(e) =>
                                updateField("website", e.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                            placeholder="https://example.com"
                        />
                    </div>

                    {/* =========================Address======================== */}

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Address
                        </label>

                        <textarea
                            rows={3}
                            value={form.address}
                            onChange={(e) =>
                                updateField("address", e.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                            placeholder="Enter address"
                        />
                    </div>

                    {/* =========================Company Location========================= */}

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Company Location
                        </label>

                        <input
                            type="text"
                            value={form.companyLocation}
                            onChange={(e) =>
                                updateField("companyLocation", e.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                            placeholder="City, State, Country"
                        />
                    </div>

                    {/* =========================
      LinkedIn
========================= */}

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            LinkedIn Profile
                        </label>

                        <input
                            type="text"
                            value={form.linkedin}
                            onChange={(e) =>
                                updateField("linkedin", e.target.value)
                            }
                            className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none"
                            placeholder="https://linkedin.com/in/username"
                        />
                    </div>

                </div>

                {error && (
                    <div className="mx-6 mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {/* =========================
              Footer
        ========================= */}

                <div className="flex items-center justify-end gap-3 border-t bg-gray-50 p-6">

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="rounded-lg border border-gray-300 px-5 py-2 font-medium text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        disabled={loading}
                        onClick={async () => {
                            try {
                                setLoading(true);
                                setError(null);

                                const response = await fetch(
                                    `/api/contacts/${contact.id}`,
                                    {
                                        method: "PATCH",
                                        headers: {
                                            "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                            fullName: form.fullName,
                                            jobTitle: form.jobTitle,
                                            company: form.company,

                                            mobileNumbers: form.mobileNumbers.filter(
                                                (item) => item.trim() !== ""
                                            ),

                                            telephoneNumbers:
                                                form.telephoneNumbers.filter(
                                                    (item) => item.trim() !== ""
                                                ),

                                            emails: form.emails.filter(
                                                (item) => item.trim() !== ""
                                            ),

                                            website:
                                                form.website.trim() || null,

                                            address:
                                                form.address.trim() || null,

                                            companyLocation:
                                                form.companyLocation.trim() || null,

                                            linkedin:
                                                form.linkedin.trim() || null,
                                        }),
                                    }
                                );

                                if (!response.ok) {
                                    const error = await response.json();

                                    setError(
                                        error.error ??
                                        "Unable to update contact."
                                    );

                                    return;
                                }

                                const result = await response.json();
                                const updatedContact = result.data;

                                if (onSaved) {
                                    onSaved(updatedContact);
                                }

                                onClose();
                            } catch (error) {
                                console.error(error);

                                setError(
                                    "Something went wrong while updating the contact."
                                );
                            } finally {
                                setLoading(false);
                            }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Save size={18} />

                        {loading
                            ? "Saving..."
                            : "Save Changes"}
                    </button>

                </div>

            </div>
        </div>
    );
}