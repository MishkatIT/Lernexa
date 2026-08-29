"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { profileNameSchema, passwordChangeSchema } from "@/lib/schemas";
import { updateProfileName, changePassword } from "@/actions/profile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Alert } from "@/components/ui/Alert";

export function ProfileForm({
  initialName,
  initialBio,
}: {
  initialName: string;
  initialBio: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [bioError, setBioError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const dirty =
    name.trim() !== initialName.trim() || bio.trim() !== initialBio.trim();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSaved(false);

    const parsed = profileNameSchema.safeParse({ fullName: name, bio });
    if (!parsed.success) {
      const byPath = (p: string) =>
        parsed.error.issues.find((i) => i.path[0] === p)?.message;
      setFieldError(byPath("fullName"));
      setBioError(byPath("bio"));
      return;
    }
    setFieldError(undefined);
    setBioError(undefined);
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
      {saved ? <Alert tone="success">Your profile has been updated.</Alert> : null}

      <Input
        label="Full name"
        name="fullName"
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldError}
      />

      <Textarea
        label="Bio"
        name="bio"
        value={bio}
        maxLength={280}
        onChange={(e) => setBio(e.target.value)}
        error={bioError}
        placeholder="A sentence or two about you — shown on articles you write."
        className="min-h-20"
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
