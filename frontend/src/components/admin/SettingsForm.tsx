"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateSiteSettings } from "@/actions/admin";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import type { SiteSettings } from "@/lib/admin";

export function SettingsForm({ initial }: { initial: SiteSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [siteName, setSiteName] = useState(initial.siteName);
  const [registrationEnabled, setRegistrationEnabled] = useState(
    initial.registrationEnabled,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    siteName !== initial.siteName ||
    registrationEnabled !== initial.registrationEnabled;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await updateSiteSettings({ siteName, registrationEnabled });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast("Settings saved");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? <Alert>{error}</Alert> : null}

      <Input
        label="Site name"
        value={siteName}
        onChange={(e) => setSiteName(e.target.value)}
      />

      <label className="flex items-start gap-3 text-body text-ink-900">
        <input
          type="checkbox"
          checked={registrationEnabled}
          onChange={(e) => setRegistrationEnabled(e.target.checked)}
          className="mt-1 h-4 w-4 accent-accent-600"
        />
        <span>
          Allow public registration
          <span className="mt-0.5 block text-small text-ink-500">
            When off, the register endpoint returns 403 for everyone.
          </span>
        </span>
      </label>

      <div>
        <Button onClick={save} loading={busy} loadingLabel="Saving…" disabled={!dirty}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
