"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { profileNameSchema, passwordChangeSchema } from "@/lib/schemas";
import { updateProfileName, changePassword } from "@/actions/profile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

export function ProfileForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const dirty = name.trim() !== initialName.trim();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);

    const parsed = profileNameSchema.safeParse({ fullName: name });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    setPending(true);
    const res = await updateProfileName(parsed.data);
    setPending(false);

    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert>{formError}</Alert> : null}
      {saved ? <Alert tone="success">Your name has been updated.</Alert> : null}

      <Input
        label="Full name"
        name="fullName"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldError}
      />

      <div>
        <Button
          type="submit"
          loading={pending}
          loadingLabel="Saving…"
          disabled={!dirty}
        >
          Save changes
        </Button>
      </div>
    </form>
  );
}

const EMPTY = { currentPassword: "", password: "", confirmPassword: "" };

export function PasswordForm() {
  const [values, setValues] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  function set(key: keyof typeof EMPTY, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setDone(false);

    const parsed = passwordChangeSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), i.message]),
        ),
      );
      return;
    }
    setFieldErrors({});
    setPending(true);
    const res = await changePassword(parsed.data);
    setPending(false);

    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    setValues(EMPTY);
    setDone(true);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert>{formError}</Alert> : null}
      {done ? <Alert tone="success">Your password has been changed.</Alert> : null}

      <Input
        label="Current password"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        value={values.currentPassword}
        onChange={(e) => set("currentPassword", e.target.value)}
        error={fieldErrors.currentPassword}
      />
      <Input
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        value={values.password}
        onChange={(e) => set("password", e.target.value)}
        error={fieldErrors.password}
      />
      <Input
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        value={values.confirmPassword}
        onChange={(e) => set("confirmPassword", e.target.value)}
        error={fieldErrors.confirmPassword}
      />

      <div>
        <Button type="submit" loading={pending} loadingLabel="Updating…">
          Update password
        </Button>
      </div>
    </form>
  );
}
