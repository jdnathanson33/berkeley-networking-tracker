/**
 * Backend: a single contact.
 *
 *   PATCH  /api/contacts/:id   edit
 *   DELETE /api/contacts/:id   delete
 *
 * Neither handler filters by user_id in application code -- and that is
 * deliberate. Row Level Security adds `AND user_id = auth.user_id()` to the
 * statement inside Postgres. If you ask to edit someone else's contact, the
 * UPDATE matches zero rows and you get a 404. There is no code path that could
 * be made to skip the check, because the check is not in the code.
 */
import { NextResponse, type NextRequest } from "next/server";
import { contactUpdateSchema, formatValidationError } from "@/lib/validation";
import { getSessionUser } from "@/lib/auth-server";
import { getUserDataClient, NotAuthenticatedError } from "@/lib/data-api";
import { jsonDbError, jsonError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(request: NextRequest, context: Context) {
  const user = await getSessionUser();
  if (!user) return jsonError("You need to be signed in.", 401);

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("That contact id isn't valid.", 400);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body.", 400);
  }

  const parsed = contactUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const { message, fieldErrors } = formatValidationError(parsed.error);
    return jsonError(message, 400, fieldErrors);
  }

  // Defensive: even if a client sent user_id, we strip it. The RLS WITH CHECK
  // clause would reject it anyway, but there is no reason to send it upstream.
  const { user_id: _ignored, ...updates } = parsed.data as Record<string, unknown>;

  try {
    const db = await getUserDataClient();
    const { data, error } = await db
      .from("contacts")
      .update(updates)
      .eq("id", id)
      .select();

    if (error) return jsonDbError(error);
    if (!data || data.length === 0) {
      return jsonError("That contact doesn't exist, or isn't yours.", 404);
    }
    return NextResponse.json({ contact: data[0] });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return jsonError("You need to be signed in.", 401);
    }
    console.error("[contacts] PATCH failed", error);
    return jsonError("Couldn't update that contact. Please try again.", 500);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const user = await getSessionUser();
  if (!user) return jsonError("You need to be signed in.", 401);

  const id = parseId((await context.params).id);
  if (id === null) return jsonError("That contact id isn't valid.", 400);

  try {
    const db = await getUserDataClient();
    const { data, error } = await db
      .from("contacts")
      .delete()
      .eq("id", id)
      .select();

    if (error) return jsonDbError(error);
    if (!data || data.length === 0) {
      return jsonError("That contact doesn't exist, or isn't yours.", 404);
    }
    return NextResponse.json({ deleted: id });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return jsonError("You need to be signed in.", 401);
    }
    console.error("[contacts] DELETE failed", error);
    return jsonError("Couldn't delete that contact. Please try again.", 500);
  }
}
