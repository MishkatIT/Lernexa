"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/** Clears the (now useless) session cookie via the logout route, then returns
 *  to /login. Middleware re-evaluates the navigation with no cookie present. */
export function ClearSessionLink() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="secondary"
      loading={busy}
      loadingLabel="…"
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        try {
          localStorage.setItem("lernexa:authed", "0");
        } catch {
          /* ignore */
        }
        router.push("/login");
        router.refresh();
      }}
    >
      Back to login
    </Button>
  );
}
