import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-server";
import { AuthForm } from "@/components/auth-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await getSessionUser()) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <AuthForm mode="sign-in" />
    </main>
  );
}
