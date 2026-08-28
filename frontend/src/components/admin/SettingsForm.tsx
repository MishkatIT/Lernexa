"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSiteSettings } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { SiteSettings } from "@/lib/admin";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const [siteName, setSiteName] = useState(initial.siteName);
  const [registrationEnabled, setRegistrationEnabled] = useState(
    initial.registrationEnabled,
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await updateSiteSettings({ siteName, registrationEnabled });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMsg("Saved.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="border-l-[3px] border-danger bg-accent-100/40 px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      ) : null}
      {msg ? <p className="text-[13px] text-success">{msg}</p> : null}

      <Input
        label="Site name"
        value={siteName}
        onChange={(e) => setSiteName(e.target.value)}
      />

      <label className="flex items-center gap-2 text-[14px] text-ink-900">
        <input
          type="checkbox"
          checked={registrationEnabled}
          onChange={(e) => setRegistrationEnabled(e.target.checked)}
        />
        Allow public registration
      </label>

      <div>
        <Button onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
