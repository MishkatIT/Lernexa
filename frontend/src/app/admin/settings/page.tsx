import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/admin";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
        Site settings
      </h1>
      <p className="mt-1 mb-6 text-[15px] text-ink-500">
        Enforced on the backend — turning off registration makes the register
        endpoint return 403, not just hides the link.
      </p>
      <SettingsForm initial={settings} />
    </div>
  );
}
