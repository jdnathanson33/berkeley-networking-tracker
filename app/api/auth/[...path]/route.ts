/**
 * Neon Managed Better Auth request handler.
 *
 * Every auth call the browser makes (sign up, sign in, sign out, get session)
 * hits this same-origin route. It proxies to Neon Auth using the server-only
 * cookie secret and sets an HttpOnly session cookie on the response.
 */
import { auth } from "@/lib/auth-server";

export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
