import { NextResponse } from "next/server";

export type ApiError = { error: string; fieldErrors?: Record<string, string> };

export function jsonError(
  message: string,
  status: number,
  fieldErrors?: Record<string, string>,
) {
  return NextResponse.json<ApiError>(
    fieldErrors ? { error: message, fieldErrors } : { error: message },
    { status },
  );
}

/**
 * Translate a Postgres/PostgREST error into a safe, human-readable response.
 *
 * Two things matter here:
 *  - We never leak raw database errors to the browser.
 *  - A CHECK constraint violation is the user's fault (400), not ours (500).
 *    This is what makes an invalid priority "fail safely with a clear message"
 *    even if it somehow slipped past the Zod layer.
 */
export function jsonDbError(error: { code?: string; message?: string } | null) {
  const code = error?.code ?? "";

  if (code === "23514") {
    const message = error?.message ?? "";
    if (message.includes("contacts_priority_allowed")) {
      return jsonError("Priority must be one of: high, medium, low.", 400, {
        priority: "Priority must be one of: high, medium, low.",
      });
    }
    if (message.includes("contacts_name_not_blank")) {
      return jsonError("Name is required.", 400, { name: "Name is required." });
    }
    return jsonError("That contact isn't valid.", 400);
  }

  // 42501 = insufficient privilege, i.e. Row Level Security refused the write.
  if (code === "42501") {
    return jsonError("You don't have access to that contact.", 403);
  }

  if (code === "23502") {
    return jsonError("A required field was missing.", 400);
  }

  console.error("[contacts] database error", error);
  return jsonError("Something went wrong saving your contact. Please try again.", 500);
}
