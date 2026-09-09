/**
 * Server-side authentication.
 *
 * This module reads NEON_AUTH_COOKIE_SECRET, which is a real secret. It has no
 * NEXT_PUBLIC_ prefix, so Next.js will never inline it into a browser bundle.
 * Nothing in `components/` or any "use client" file imports this module.
 */
import { createNeonAuth } from "@neondatabase/neon-js/auth/next/server";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const auth = createNeonAuth({
  baseUrl: required("NEON_AUTH_BASE_URL"),
  cookies: {
    secret: required("NEON_AUTH_COOKIE_SECRET"),
  },
});

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
};

/**
 * Returns the signed-in user, or null. Every API route calls this first.
 * The session lives in an HttpOnly, signed cookie, so client JavaScript
 * cannot read or forge it.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { data, error } = await auth.getSession();
  if (error || !data?.user) return null;
  return data.user as SessionUser;
}
