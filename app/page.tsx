/**
 * The dashboard. This is a Server Component: the session check happens on the
 * server before a single byte of contact UI is sent to the browser. A signed-out
 * visitor is redirected and never receives the page at all.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-server";
import { ContactsView } from "@/components/contacts-view";
import { SignOutButton } from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">
              Networking Tracker
            </h1>
            <p className="truncate text-xs text-[var(--muted-foreground)]">
              Signed in as {user.email}
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <ContactsView />
      </main>
    </div>
  );
}
