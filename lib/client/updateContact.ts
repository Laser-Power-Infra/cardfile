import type { NormalizedContact } from "@/types/contact";

export async function updateContact(
  id: string,
  contact: NormalizedContact
) {
  const response = await fetch(`/api/contacts/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(contact),
  });

  if (!response.ok) {
    throw new Error("Failed to update contact.");
  }

  const result = await response.json();

  return result.data;
}