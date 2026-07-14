export async function deleteContact(id: string) {
  const response = await fetch(`/api/contacts/${id}`, {
    method: "DELETE",
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || "Failed to delete contact.");
  }

  return result.data;
}
