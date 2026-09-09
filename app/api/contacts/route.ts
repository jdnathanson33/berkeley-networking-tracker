/**
 * Backend: the contacts collection.
 *
 *   GET  /api/contacts   list the signed-in user's contacts (sortable, filterable)
 *   POST /api/contacts   create a contact
 *
 * Request flow for every handler below:
 *   1. Verify the session cookie server-side. No session -> 401, nothing else runs.
 *   2. Validate the payload with Zod. Invalid -> 400 with a field-level message.
 *   3. Call the Neon Data API with THIS USER'S JWT, so RLS scopes the query.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  contactInputSchema,
  formatValidationError,
  parsePriorityFilter,
  parseSortDirection,
  parseSortField,
} from "@/lib/validation";
import { getSessionUser } from "@/lib/auth-server";
import { getUserDataClient, NotAuthenticatedError } from "@/lib/data-api";
import { jsonDbError, jsonError } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("You need to be signed in.", 401);

  const params = request.nextUrl.searchParams;
  const sort = parseSortField(params.get("sort"));
  const direction = parseSortDirection(params.get("dir"));
  const priority = parsePriorityFilter(params.get("priority"));
  const search = (params.get("q") ?? "").trim();

  try {
    const db = await getUserDataClient();
    let query = db.from("contacts").select("*");

    if (priority) query = query.eq("priority", priority);

    if (search) {
      // Escape PostgREST's pattern metacharacters so a search for "%" is literal.
      const safe = search.replace(/[%,()*]/g, "");
      if (safe) {
        query = query.or(
          `name.ilike.*${safe}*,company.ilike.*${safe}*,role.ilike.*${safe}*,where_met.ilike.*${safe}*`,
        );
      }
    }

    const { data, error } = await query.order(sort, {
      ascending: direction === "asc",
    });

    if (error) return jsonDbError(error);
    return NextResponse.json({ contacts: data ?? [] });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return jsonError("You need to be signed in.", 401);
    }
    console.error("[contacts] GET failed", error);
    return jsonError("Couldn't load your contacts. Please try again.", 500);
  }
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return jsonError("You need to be signed in.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Expected a JSON body.", 400);
  }

  const parsed = contactInputSchema.safeParse(body);
  if (!parsed.success) {
    const { message, fieldErrors } = formatValidationError(parsed.error);
    return jsonError(message, 400, fieldErrors);
  }

  try {
    const db = await getUserDataClient();

    // Note what is NOT here: user_id. The column defaults to auth.user_id(),
    // so the row is stamped with the token's owner by the database itself.
    // A client cannot claim to be someone else, because it never gets to say.
    const { data, error } = await db
      .from("contacts")
      .insert(parsed.data)
      .select()
      .single();

    if (error) return jsonDbError(error);
    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (error) {
    if (error instanceof NotAuthenticatedError) {
      return jsonError("You need to be signed in.", 401);
    }
    console.error("[contacts] POST failed", error);
    return jsonError("Couldn't save that contact. Please try again.", 500);
  }
}
