import type { Metadata } from "next";
import { requireUser } from "@/lib/guards";
import { ROLE_LABELS, type RoleType } from "@/lib/roles";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { AvatarField } from "@/components/settings/AvatarField";
import { ProfileForm, PasswordForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  const roleLabel =
    ROLE_LABELS[user.role?.type as RoleType] ?? user.role?.name ?? "—";

  return (
    <Container size="content" className="py-10 sm:py-14">
      <p className="text-small font-medium uppercase tracking-[0.14em] text-ink-500">
        Account
      </p>
      <h1 className="mt-1.5 text-display text-ink-900">Settings</h1>
      <p className="mt-2 text-reading text-ink-700">
        Manage the name shown across Lernexa and your sign-in password.
      </p>

      <div className="mt-10 flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="text-h3 text-ink-900">Profile</h2>
          <p className="mt-1 text-small text-ink-500">
            Your name appears in the header, on your dashboard and next to any
            content you create.
          </p>

          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-small">
            <dt className="text-ink-500">Email</dt>
            <dd className="font-mono text-ink-700">{user.email}</dd>
            <dt className="text-ink-500">Role</dt>
            <dd className="text-ink-700">{roleLabel}</dd>
          </dl>

          <div className="mt-6 border-t border-ink-200 pt-6">
            <AvatarField
              initialUrl={user.avatarUrl}
              name={user.fullName ?? user.username}
            />
          </div>

          <div className="mt-6 border-t border-ink-200 pt-6">
            <ProfileForm initialName={user.fullName ?? user.username} />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-h3 text-ink-900">Password</h2>
          <p className="mt-1 text-small text-ink-500">
            Choose a new password of at least 6 characters. You&rsquo;ll stay
            signed in on this device.
          </p>
          <div className="mt-6">
            <PasswordForm />
          </div>
        </Card>
      </div>
    </Container>
  );
}
