"use client";

/**
 * Browser-side authentication client.
 *
 * It talks only to this app's own /api/auth/* routes on the same origin.
 * Those routes proxy to Neon Auth server-side, which is why the cookie secret
 * never has to leave the server.
 */
import { createAuthClient } from "@neondatabase/neon-js/auth/next";

export const authClient = createAuthClient();
