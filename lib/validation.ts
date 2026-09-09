/**
 * The single source of truth for what a valid contact looks like.
 *
 * This module is imported by the API route handlers (trusted server code) and
 * exercised directly by the automated tests. The browser form uses the same
 * rules for instant feedback, but the browser's opinion is never trusted --
 * the server re-validates every payload, and Postgres CHECK constraints stand
 * behind that as a third line of defense.
 */
import { z } from "zod";

export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const SORTABLE_FIELDS = [
  "name",
  "company",
  "priority",
  "created_at",
  "updated_at",
] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

/**
 * An optional free-text field. Blank strings and undefined both collapse to
 * null so the database never stores the empty string as if it were a value.
 */
const optionalText = (label: string, max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => (typeof value === "string" ? value.trim() : ""))
    .transform((value) => (value.length === 0 ? null : value))
    .refine((value) => value === null || value.length <= max, {
      error: `${label} must be ${max} characters or fewer.`,
    });

export const contactInputSchema = z.object({
  name: z
    .string({ error: "Name is required." })
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, { error: "Name is required." })
    .refine((value) => value.length <= 120, {
      error: "Name must be 120 characters or fewer.",
    }),
  company: optionalText("Company", 120),
  role: optionalText("Role", 120),
  where_met: optionalText("Where you met", 200),
  notes: optionalText("Notes", 2000),
  priority: z.enum(PRIORITIES, {
    error: "Priority must be one of: high, medium, low.",
  }),
});

export type ContactInput = z.infer<typeof contactInputSchema>;

/** Editing sends only the fields that changed, but at least one of them. */
export const contactUpdateSchema = contactInputSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: "No fields to update.",
  });

export type ContactUpdate = z.infer<typeof contactUpdateSchema>;

/** A contact row as it comes back from the database. */
export type Contact = {
  id: number;
  user_id: string;
  name: string;
  company: string | null;
  role: string | null;
  where_met: string | null;
  notes: string | null;
  priority: Priority;
  created_at: string;
  updated_at: string;
};

/**
 * Turn a ZodError into something a human can read and a form can highlight.
 * Reading `issues` directly keeps this stable across Zod versions.
 */
export function formatValidationError(error: z.ZodError): {
  message: string;
  fieldErrors: Record<string, string>;
} {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  const message =
    error.issues[0]?.message ?? "That contact isn't valid. Please check the form.";
  return { message, fieldErrors };
}

/** Whitelist for the ?sort= query parameter, so a user cannot inject SQL-ish input. */
export function parseSortField(value: string | null): SortField {
  return (SORTABLE_FIELDS as readonly string[]).includes(value ?? "")
    ? (value as SortField)
    : "created_at";
}

export function parseSortDirection(value: string | null): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

/** Whitelist for the ?priority= filter. Anything else means "no filter". */
export function parsePriorityFilter(value: string | null): Priority | null {
  return (PRIORITIES as readonly string[]).includes(value ?? "")
    ? (value as Priority)
    : null;
}
