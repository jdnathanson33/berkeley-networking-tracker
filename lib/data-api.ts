/**
 * Server-side Neon Data API client.
 *
 * The important detail: we do NOT connect to Postgres with an admin credential
 * and then filter by user in application code. Instead we fetch the signed-in
 * user's own JWT and hand that to the Data API. Postgres verifies the token,
 * `auth.user_id()` resolves to that user's id, and Row Level Security filters
 * every row before the query ever returns. The server has no more privilege
 * over the contacts table than the user does.
 */
import { createClient } from "@neondatabase/neon-js";
import { auth } from "./auth-server";
import type { Contact } from "./validation";

export type Database = {
  public: {
    Tables: {
      contacts: {
        Row: Contact;
        Insert: Omit<Contact, "id" | "user_id" | "created_at" | "updated_at"> & {
          user_id?: string;
        };
        Update: Partial<Omit<Contact, "id" | "user_id">>;
      };
    };
  };
};

export class NotAuthenticatedError extends Error {
  constructor() {
    super("You need to be signed in to do that.");
    this.name = "NotAuthenticatedError";
  }
}

/**
 * Ask Neon Auth for the current user's JWT. Returns null when signed out.
 */
async function getUserToken(): Promise<string | null> {
  const { data, error } = await auth.token();
  if (error) return null;
  const token = (data as { token?: string } | null)?.token;
  return typeof token === "string" && token.length > 0 ? token : null;
}

/**
 * Build a Data API client scoped to the signed-in user.
 * Throws NotAuthenticatedError when there is no session.
 */
export async function getUserDataClient() {
  const token = await getUserToken();
  if (!token) throw new NotAuthenticatedError();

  const dataApiUrl = process.env.NEXT_PUBLIC_NEON_DATA_API_URL;
  if (!dataApiUrl) {
    throw new Error("Missing environment variable NEXT_PUBLIC_NEON_DATA_API_URL.");
  }

  return createClient<Database>({
    dataApi: {
      url: dataApiUrl,
      getToken: async () => token,
    },
  });
}
