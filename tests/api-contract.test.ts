/**
 * These tests exercise the real POST /api/contacts route handler with the
 * database mocked out. The point is to prove the ORDER of the checks:
 *
 *   no session      -> 401, and the database is never touched
 *   bad payload     -> 400 with a field-level message, database never touched
 *   good payload    -> the row we send upstream contains NO user_id, because
 *                      the database stamps ownership itself via auth.user_id()
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUser = vi.fn();
const insertedRows: unknown[] = [];
const getUserDataClient = vi.fn();

vi.mock("@/lib/auth-server", () => ({
  getSessionUser: () => getSessionUser(),
  auth: {},
}));

class NotAuthenticatedError extends Error {}

vi.mock("@/lib/data-api", () => ({
  getUserDataClient: () => getUserDataClient(),
  NotAuthenticatedError,
}));

function fakeDb() {
  return {
    from: () => ({
      insert: (row: unknown) => {
        insertedRows.push(row);
        return {
          select: () => ({
            single: async () => ({ data: { id: 1, ...(row as object) }, error: null }),
          }),
        };
      },
    }),
  };
}

async function post(body: unknown) {
  const { POST } = await import("@/app/api/contacts/route");
  const request = new Request("http://localhost/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // The handler only reads .json() and returns a Response.
  return POST(request as never);
}

beforeEach(() => {
  insertedRows.length = 0;
  getSessionUser.mockReset();
  getUserDataClient.mockReset();
  getUserDataClient.mockResolvedValue(fakeDb());
});

describe("POST /api/contacts", () => {
  it("returns 401 and never queries the database when signed out", async () => {
    getSessionUser.mockResolvedValue(null);

    const response = await post({ name: "Priya", priority: "high" });

    expect(response.status).toBe(401);
    expect(getUserDataClient).not.toHaveBeenCalled();
  });

  it("returns 400 with a clear message for an empty name", async () => {
    getSessionUser.mockResolvedValue({ id: "user_a", email: "a@example.com" });

    const response = await post({ name: "", priority: "high" });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Name is required.");
    expect(payload.fieldErrors.name).toBe("Name is required.");
    expect(insertedRows).toHaveLength(0);
  });

  it("returns 400 with a clear message for an invalid priority", async () => {
    getSessionUser.mockResolvedValue({ id: "user_a", email: "a@example.com" });

    const response = await post({ name: "Priya", priority: "urgent" });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Priority must be one of: high, medium, low.");
    expect(insertedRows).toHaveLength(0);
  });

  it("creates a contact and does not send user_id upstream", async () => {
    getSessionUser.mockResolvedValue({ id: "user_a", email: "a@example.com" });

    const response = await post({ name: "  Priya Raman  ", priority: "high" });

    expect(response.status).toBe(201);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).not.toHaveProperty("user_id");
    expect((insertedRows[0] as { name: string }).name).toBe("Priya Raman");
  });

  it("ignores a user_id a malicious client tries to inject", async () => {
    getSessionUser.mockResolvedValue({ id: "user_a", email: "a@example.com" });

    const response = await post({
      name: "Priya",
      priority: "high",
      user_id: "somebody_else",
    });

    expect(response.status).toBe(201);
    expect(insertedRows[0]).not.toHaveProperty("user_id");
  });
});
