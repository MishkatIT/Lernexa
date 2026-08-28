"use client";

import { useState } from "react";

/** Clears the (now useless) session cookie via the logout route, then goes to
 *  /login. A full navigation, not router.push, so middleware re-evaluates with
 *  no cookie. */
export function ClearSessionLink() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      }}
      className="rounded-sm border border-ink-200 px-4 py-2 text-[15px] font-medium text-ink-900 hover:bg-ink-100 disabled:opacity-60"
    >
      {busy ? "…" : "Back to login"}
    </button>
  );
}
