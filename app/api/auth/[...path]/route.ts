/**
 * Neon Managed Better Auth request handler.
 *
 * Every auth call the browser makes (sign up, sign in, sign out, get session)
 * hits this same-origin route. It proxies to Neon Auth using the server-only
 * cookie secret and sets an HttpOnly session cookie on the response.
 *
 * The handler is built per request rather than at module load, so that
 * `npm run build` succeeds on a freshly cloned checkout that has no .env.local
 * yet. Missing configuration then fails at request time with a message that
 * names the variable, instead of an opaque build error.
 */
import { auth } from "@/lib/auth-server";

type Context = { params: Promise<{ path: string[] }> };

const proxy =
  (method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH") =>
  (request: Request, context: Context) =>
    auth.handler()[method](request, context);

export const GET = proxy("GET");
export const POST = proxy("POST");
export const PUT = proxy("PUT");
export const DELETE = proxy("DELETE");
export const PATCH = proxy("PATCH");
