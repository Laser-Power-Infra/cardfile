import { NextRequest, NextResponse } from "next/server";
import { updateContact, ContactUpdateError } from "@/lib/services/contactUpdateService";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const body = await request.json();

    const { id } = await context.params;

    const updatedContact = await updateContact(id, body);

    return NextResponse.json({
      success: true,
      data: updatedContact,
    });
  } catch (error) {
    console.error(error);

    // ContactUpdateError carries the right HTTP status (404 not found,
    // 422 validation failure, 409 duplicate collision). Anything else is a
    // genuine unexpected server error, so that still falls back to 500.
    const status = error instanceof ContactUpdateError ? error.status : 500;

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update contact.",
      },
      {
        status,
      }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const { id } = await context.params;

    const existing = await prisma.contact.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Contact not found." },
        { status: 404 }
      );
    }

    await prisma.contact.delete({ where: { id } });

    // Best-effort: also clear any cached "View Profile" lookup for this
    // contact so a re-added contact with the same id (unlikely, but possible
    // via restore/import) doesn't inherit stale cached data.
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "ProfileCache" WHERE "contactId" = $1;`, id);
    } catch {
      // Table may not exist yet if View Profile was never used — safe to ignore.
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unable to delete contact.",
      },
      { status: 500 }
    );
  }
}
