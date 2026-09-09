"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const [pending, setPending] = React.useState(false);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        // Hard navigation so the server sees the cleared cookie immediately.
        window.location.assign("/sign-in");
      }}
    >
      <LogOut />
      <span className="hidden sm:inline">{pending ? "Signing out…" : "Sign out"}</span>
    </Button>
  );
}
