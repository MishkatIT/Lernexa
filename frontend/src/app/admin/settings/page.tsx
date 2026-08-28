import type { Metadata } from "next";
import { getSiteSettings } from "@/lib/admin";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader
        as="h1"
        eyebrow="Admin"
        title="Site settings"
        description="Enforced on the backend — turning off registration makes the register endpoint return 403, not just hide the link."
      />
      <div className="mt-8">
        <SettingsForm initial={settings} />
      </div>
    </div>
  );
}
