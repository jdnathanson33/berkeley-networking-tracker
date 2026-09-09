/**
 * These tests pin down the server-side validation contract.
 *
 * They target lib/validation.ts directly -- the exact module the API route
 * handlers import -- so a passing run proves the rules the server actually
 * enforces, not a copy of them.
 */
import { describe, expect, it } from "vitest";
import {
  contactInputSchema,
  contactUpdateSchema,
  formatValidationError,
  parsePriorityFilter,
  parseSortField,
} from "@/lib/validation";

const validContact = {
  name: "Priya Raman",
  company: "Pixar",
  role: "Head of Production",
  where_met: "Haas orientation",
  notes: "Follow up in October.",
  priority: "high",
};

describe("contactInputSchema — required name", () => {
  it("rejects an empty name", () => {
    const result = contactInputSchema.safeParse({ ...validContact, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatValidationError(result.error).fieldErrors.name).toBe("Name is required.");
    }
  });

  it("rejects a name that is only whitespace", () => {
    const result = contactInputSchema.safeParse({ ...validContact, name: "   \t  " });
    expect(result.success).toBe(false);
  });

  it("rejects a missing name", () => {
    const { name: _omitted, ...withoutName } = validContact;
    expect(contactInputSchema.safeParse(withoutName).success).toBe(false);
  });

  it("trims surrounding whitespace from a valid name", () => {
    const result = contactInputSchema.safeParse({ ...validContact, name: "  Dean Harrison  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Dean Harrison");
  });

  it("rejects a name longer than 120 characters", () => {
    const result = contactInputSchema.safeParse({ ...validContact, name: "a".repeat(121) });
    expect(result.success).toBe(false);
  });
});

describe("contactInputSchema — priority is one of three values", () => {
  it.each(["high", "medium", "low"])("accepts %s", (priority) => {
    const result = contactInputSchema.safeParse({ ...validContact, priority });
    expect(result.success).toBe(true);
  });

  it.each(["urgent", "HIGH", "", "1", "critical"])("rejects %o", (priority) => {
    const result = contactInputSchema.safeParse({ ...validContact, priority });
    expect(result.success).toBe(false);
  });

  it("gives a message that names the three allowed values", () => {
    const result = contactInputSchema.safeParse({ ...validContact, priority: "urgent" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatValidationError(result.error).message).toBe(
        "Priority must be one of: high, medium, low.",
      );
    }
  });

  it("rejects a missing priority", () => {
    const { priority: _omitted, ...withoutPriority } = validContact;
    expect(contactInputSchema.safeParse(withoutPriority).success).toBe(false);
  });

  it("rejects a non-string priority", () => {
    expect(contactInputSchema.safeParse({ ...validContact, priority: 1 }).success).toBe(false);
  });
});

describe("contactInputSchema — optional fields", () => {
  it("accepts a contact with only a name and a priority", () => {
    const result = contactInputSchema.safeParse({ name: "Sam Ortiz", priority: "low" });
    expect(result.success).toBe(true);
  });

  it("normalises blank optional fields to null rather than empty strings", () => {
    const result = contactInputSchema.safeParse({
      name: "Sam Ortiz",
      priority: "low",
      company: "   ",
      notes: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.company).toBeNull();
      expect(result.data.notes).toBeNull();
    }
  });

  it("rejects notes longer than 2000 characters", () => {
    const result = contactInputSchema.safeParse({
      ...validContact,
      notes: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe("contactUpdateSchema", () => {
  it("accepts a single-field edit", () => {
    expect(contactUpdateSchema.safeParse({ priority: "low" }).success).toBe(true);
  });

  it("rejects an empty update", () => {
    expect(contactUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("still rejects a blank name on edit", () => {
    expect(contactUpdateSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("still rejects an invalid priority on edit", () => {
    expect(contactUpdateSchema.safeParse({ priority: "urgent" }).success).toBe(false);
  });
});

describe("query-parameter whitelists", () => {
  it("falls back to created_at for an unknown sort field", () => {
    expect(parseSortField("name")).toBe("name");
    expect(parseSortField("password")).toBe("created_at");
    expect(parseSortField("name; drop table contacts")).toBe("created_at");
    expect(parseSortField(null)).toBe("created_at");
  });

  it("ignores an unknown priority filter instead of passing it through", () => {
    expect(parsePriorityFilter("high")).toBe("high");
    expect(parsePriorityFilter("urgent")).toBeNull();
    expect(parsePriorityFilter(null)).toBeNull();
  });
});
