"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "sign-in" | "sign-up";

/**
 * Turn whatever the auth client gives us into something a person can act on.
 *
 * Better Auth surfaces some failures as a returned `error` object and others as
 * a thrown exception, and the raw codes ("EMAIL_NOT_VERIFIED") are not useful to
 * a user. This is the one place that mapping lives.
 */
function describeAuthError(error: unknown): string {
  const record =
    typeof error === "object" && error !== null
      ? (error as { code?: string; status?: number; message?: string })
      : {};

  switch (record.code) {
    case "EMAIL_NOT_VERIFIED":
      return "Check your inbox — you need to verify your email address before signing in.";
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_CREDENTIALS":
      return "That email and password don't match an account.";
    case "USER_ALREADY_EXISTS":
      return "An account with that email already exists. Try signing in instead.";
    case "PASSWORD_TOO_SHORT":
      return "Password must be at least 8 characters.";
  }

  if (record.status === 401 || record.status === 403) {
    return record.message || "That didn't work. Check your details and try again.";
  }
  if (record.message) return record.message;

  return "Couldn't reach the server. Check your connection and try again.";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const isSignUp = mode === "sign-up";

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (isSignUp && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setPending(true);
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name: name || email })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(describeAuthError(result.error));
        setPending(false);
        return;
      }

      // A full page load, not router.push: the sign-in response sets the session
      // cookie, and a hard navigation guarantees the server sees it on the very
      // next request. A client-side transition can race the cookie write and
      // bounce the user straight back to this page.
      window.location.assign("/");
    } catch (caught) {
      setError(describeAuthError(caught));
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {isSignUp
            ? "Start keeping track of who you meet at Berkeley."
            : "Sign in to see your contacts."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {isSignUp && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="JD Nathanson"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@berkeley.edu"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete={isSignUp ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSignUp ? "At least 8 characters" : ""}
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]"
          >
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="mt-2">
          {pending && <Loader2 className="animate-spin" />}
          {isSignUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        {isSignUp ? "Already have an account? " : "Don't have an account? "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-medium text-[var(--primary)] underline-offset-4 hover:underline"
        >
          {isSignUp ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}
