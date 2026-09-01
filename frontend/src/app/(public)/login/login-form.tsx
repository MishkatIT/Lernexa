"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginSchema } from "@/lib/schemas";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";

export function LoginForm() {
  const router = useRouter();
  const returnTo = useSearchParams().get("returnTo");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);

    const fd = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });

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

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const body = await res.json();

    if (!body.ok) {
      setPending(false);
      setFormError(body.error ?? "Could not log in");
      return;
    }

    try {
      localStorage.setItem("lernexa:authed", "1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("lernexa:navigate"));
    router.push(returnTo || body.redirectTo || "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
      {formError ? <Alert>{formError}</Alert> : null}

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={fieldErrors.email}
      />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        error={fieldErrors.password}
      />

      <Button type="submit" loading={pending} loadingLabel="Logging in…" className="mt-1">
        Log in
      </Button>
    </form>
  );
}
